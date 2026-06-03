const mysql = require("mysql2/promise");
const { getDb, closeDb } = require("../src/config/db");
const { cleanupOrphanUploads } = require("../src/utils/upload");
const {
    buildJsonRequest,
    getApiBase,
    getDatabaseUrl,
    waitForApiReady
} = require("./shared");

const MESSAGE_SENDER_COUNT = 5;
const MESSAGE_PER_SENDER = 4;
const FAVORITE_ACTOR_COUNT = 8;
const LIST_PRODUCT_COUNT = 12;
const LIST_REQUEST_COUNT = 36;
const UPLOAD_REQUEST_COUNT = 6;
const NOTIFICATION_READ_REQUEST_COUNT = 5;

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function logStep(step, detail) {
    console.log(`[${step}] ${detail}`);
}

function percentile(sortedNumbers, ratio) {
    if (!sortedNumbers.length) {
        return 0;
    }

    const index = Math.min(sortedNumbers.length - 1, Math.max(0, Math.ceil(sortedNumbers.length * ratio) - 1));
    return sortedNumbers[index];
}

function summarizeBatch(name, items) {
    const durations = items.map((item) => item.duration_ms).sort((a, b) => a - b);
    const failed = items.filter((item) => !item.ok);
    return {
        name,
        total: items.length,
        success: items.length - failed.length,
        failed: failed.length,
        min_ms: durations[0] || 0,
        p50_ms: percentile(durations, 0.5),
        p95_ms: percentile(durations, 0.95),
        max_ms: durations[durations.length - 1] || 0,
        failures: failed.slice(0, 5).map((item) => ({
            index: item.index,
            error: item.error
        }))
    };
}

async function timedTask(index, task) {
    const startedAt = Date.now();
    try {
        const value = await task();
        return {
            index,
            ok: true,
            duration_ms: Date.now() - startedAt,
            value
        };
    } catch (error) {
        return {
            index,
            ok: false,
            duration_ms: Date.now() - startedAt,
            error: error && error.message ? error.message : String(error)
        };
    }
}

async function runBatch(name, taskFactories) {
    const items = await Promise.all(taskFactories.map((taskFactory, index) => timedTask(index, taskFactory)));
    return {
        raw: items,
        summary: summarizeBatch(name, items)
    };
}

function requestJson(method, path, body, token) {
    return buildJsonRequest(method, path, body, token);
}

async function requestMultipart(path, token, fileName, mimeType, buffer) {
    const form = new FormData();
    form.append("file", new Blob([buffer], { type: mimeType }), fileName);
    const { hostname, port } = getApiBase();
    const response = await fetch(`http://${hostname}:${port}${path}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form
    });
    const data = await response.json();
    return {
        status: response.status,
        data
    };
}

async function requestText(path) {
    const { hostname, port } = getApiBase();
    const response = await fetch(`http://${hostname}:${port}${path}`);
    return {
        status: response.status,
        text: await response.text()
    };
}

async function createDbConnection() {
    return mysql.createConnection(getDatabaseUrl());
}

async function cleanupUsers(usernames) {
    const db = await createDbConnection();
    try {
        const placeholders = usernames.map(() => "?").join(",");
        const [userRows] = await db.query(`SELECT id FROM users WHERE username IN (${placeholders})`, usernames);
        const userIds = userRows.map((row) => row.id);
        if (!userIds.length) {
            return;
        }

        const idPlaceholders = userIds.map(() => "?").join(",");
        await db.beginTransaction();
        await db.query(`DELETE FROM notifications WHERE user_id IN (${idPlaceholders}) OR actor_id IN (${idPlaceholders})`, [...userIds, ...userIds]);
        await db.query(`DELETE FROM password_reset_requests WHERE user_id IN (${idPlaceholders}) OR handled_by IN (${idPlaceholders})`, [...userIds, ...userIds]);
        await db.query(`DELETE FROM hidden_conversations WHERE user_id IN (${idPlaceholders}) OR peer_id IN (${idPlaceholders})`, [...userIds, ...userIds]);
        await db.query(`DELETE FROM friends WHERE user_id IN (${idPlaceholders}) OR friend_id IN (${idPlaceholders})`, [...userIds, ...userIds]);
        await db.query(`DELETE FROM favorites WHERE user_id IN (${idPlaceholders})`, userIds);
        await db.query(`DELETE FROM likes WHERE user_id IN (${idPlaceholders})`, userIds);
        await db.query(`DELETE FROM comments WHERE user_id IN (${idPlaceholders})`, userIds);
        await db.query(`DELETE FROM messages WHERE sender_id IN (${idPlaceholders}) OR receiver_id IN (${idPlaceholders})`, [...userIds, ...userIds]);
        await db.query(`DELETE FROM reviews WHERE reviewer_id IN (${idPlaceholders}) OR reviewee_id IN (${idPlaceholders})`, [...userIds, ...userIds]);
        await db.query(`DELETE FROM orders WHERE buyer_id IN (${idPlaceholders}) OR seller_id IN (${idPlaceholders})`, [...userIds, ...userIds]);
        await db.query(`DELETE FROM reports WHERE reporter_id IN (${idPlaceholders}) OR target_owner_id IN (${idPlaceholders}) OR handled_by IN (${idPlaceholders})`, [...userIds, ...userIds, ...userIds]);
        await db.query(`DELETE FROM posts WHERE author_id IN (${idPlaceholders})`, userIds);
        await db.query(`DELETE FROM products WHERE seller_id IN (${idPlaceholders})`, userIds);
        await db.query(`DELETE FROM users WHERE id IN (${idPlaceholders})`, userIds);
        await db.commit();
    } catch (error) {
        await db.rollback();
        throw error;
    } finally {
        await db.end();
    }
}

function buildUsers() {
    const suffix = Date.now().toString().slice(-6);
    const users = {
        seller: {
            username: `bench_seller_${suffix}`,
            nickname: `鍗栧${suffix}`,
            email: `bench_seller_${suffix}@example.com`,
            password: "Seller1234!"
        }
    };

    for (let index = 1; index <= FAVORITE_ACTOR_COUNT; index += 1) {
        users[`actor${index}`] = {
            username: `bench_actor_${suffix}_${index}`,
            nickname: `鐢ㄦ埛${suffix}${index}`,
            email: `bench_actor_${suffix}_${index}@example.com`,
            password: "Actor1234!"
        };
    }

    return users;
}

async function registerUser(user) {
    const result = await requestJson("POST", "/api/auth/register", user);
    assert(result.data.code === 200, `娉ㄥ唽澶辫触: ${user.username} => ${JSON.stringify(result.data)}`);
}

async function loginUser(user) {
    const result = await requestJson("POST", "/api/auth/login", {
        username: user.username,
        password: user.password
    });
    assert(result.data.code === 200, `鐧诲綍澶辫触: ${user.username} => ${JSON.stringify(result.data)}`);
    return result.data.data;
}

async function createProduct(token, payload) {
    const result = await requestJson("POST", "/api/products", payload, token);
    assert(result.data.code === 200, `鍟嗗搧鍒涘缓澶辫触: ${JSON.stringify(result.data)}`);
    return result.data.data;
}

function createTinyPngBuffer() {
    return Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9pD6rj0AAAAASUVORK5CYII=",
        "base64"
    );
}

async function main() {
    await waitForApiReady({ timeoutMs: 30000, intervalMs: 1000 });
    const users = buildUsers();
    const usernames = Object.values(users).map((item) => item.username);
    const uploadBuffer = createTinyPngBuffer();
    const report = {
        ok: true,
        checked: [],
        batches: {}
    };

    try {
        logStep("setup", "清理旧的并发验证数据");
        await cleanupUsers(usernames);

        logStep("setup", "创建测试账号并登录");
        for (const user of Object.values(users)) {
            await registerUser(user);
        }

        const sellerAuth = await loginUser(users.seller);
        const actorAuths = [];
        for (let index = 1; index <= FAVORITE_ACTOR_COUNT; index += 1) {
            actorAuths.push(await loginUser(users[`actor${index}`]));
        }

        logStep("setup", "准备商品列表和通知目标数据");
        const listProducts = [];
        for (let index = 0; index < LIST_PRODUCT_COUNT; index += 1) {
            listProducts.push(await createProduct(sellerAuth.token, {
                title: `骞跺彂鍟嗗搧-${index + 1}-${Date.now().toString().slice(-4)}`,
                description: "鐢ㄤ簬鍟嗗搧鍒楄〃骞跺彂璇诲彇楠岃瘉",
                price: 20 + index,
                category: "other",
                condition: "used",
                campus: "main",
                images_json: "[]"
            }));
        }
        const notificationProduct = await createProduct(sellerAuth.token, {
            title: `骞跺彂閫氱煡鍟嗗搧-${Date.now().toString().slice(-4)}`,
            description: "鐢ㄤ簬鏀惰棌閫氱煡骞跺彂楠岃瘉",
            price: 199,
            category: "other",
            condition: "used",
            campus: "main",
            images_json: "[]"
        });

        logStep("messages", "并发发送消息并校验未读和会话聚合");
        const messageTasks = [];
        for (let senderIndex = 0; senderIndex < MESSAGE_SENDER_COUNT; senderIndex += 1) {
            for (let messageIndex = 0; messageIndex < MESSAGE_PER_SENDER; messageIndex += 1) {
                const auth = actorAuths[senderIndex];
                messageTasks.push(() => requestJson("POST", "/api/messages", {
                    receiver_id: sellerAuth.user.id,
                    content: `骞跺彂娑堟伅-${senderIndex + 1}-${messageIndex + 1}-${Date.now()}`
                }, auth.token).then((result) => {
                    assert(result.data.code === 200, `娑堟伅鍙戦€佸け璐? ${JSON.stringify(result.data)}`);
                    return result.data.data.id;
                }));
            }
        }
        const messageBatch = await runBatch("messages_send", messageTasks);
        report.batches.messages_send = messageBatch.summary;
        assert(messageBatch.summary.failed === 0, `娑堟伅骞跺彂鍙戦€佸瓨鍦ㄥけ璐? ${JSON.stringify(messageBatch.summary.failures)}`);

        const unreadAfterMessages = await requestJson("GET", "/api/messages/unread", undefined, sellerAuth.token);
        assert(unreadAfterMessages.data.code === 200, `鏈姹囨€绘煡璇㈠け璐? ${JSON.stringify(unreadAfterMessages.data)}`);
        assert(Number(unreadAfterMessages.data.data.chat_unread_count) === MESSAGE_SENDER_COUNT * MESSAGE_PER_SENDER,
            `娑堟伅鏈鏁板紓甯? ${JSON.stringify(unreadAfterMessages.data.data)}`
        );

        const conversationsAfterMessages = await requestJson("GET", "/api/messages/conversations", undefined, sellerAuth.token);
        assert(conversationsAfterMessages.data.code === 200, `浼氳瘽鍒楄〃鏌ヨ澶辫触: ${JSON.stringify(conversationsAfterMessages.data)}`);
        assert((conversationsAfterMessages.data.data || []).length >= MESSAGE_SENDER_COUNT,
            `浼氳瘽鑱氬悎鏁伴噺寮傚父: ${JSON.stringify(conversationsAfterMessages.data.data)}`
        );
        report.checked.push("消息并发发送、未读统计、会话聚合");

        logStep("lists", "并发读取商品列表、我的商品、会话列表、通知列表");
        const listTasks = [];
        for (let index = 0; index < 12; index += 1) {
            listTasks.push(() => requestJson("GET", "/api/products?page=1&page_size=20&sort=latest", undefined, undefined).then((result) => {
                assert(result.data.code === 200, `鍟嗗搧鍒楄〃澶辫触: ${JSON.stringify(result.data)}`);
                assert((result.data.data.list || []).length >= 1, "鍟嗗搧鍒楄〃涓虹┖");
                return result.data.data.total;
            }));
        }
        for (let index = 0; index < 8; index += 1) {
            listTasks.push(() => requestJson("GET", "/api/products/my/list?page=1&page_size=20", undefined, sellerAuth.token).then((result) => {
                assert(result.data.code === 200, `鎴戠殑鍟嗗搧澶辫触: ${JSON.stringify(result.data)}`);
                return result.data.data.total;
            }));
        }
        for (let index = 0; index < 8; index += 1) {
            listTasks.push(() => requestJson("GET", "/api/messages/conversations", undefined, sellerAuth.token).then((result) => {
                assert(result.data.code === 200, `浼氳瘽鍒楄〃澶辫触: ${JSON.stringify(result.data)}`);
                return result.data.data.length;
            }));
        }
        for (let index = 0; index < 8; index += 1) {
            listTasks.push(() => requestJson("GET", "/api/messages/notifications?kind=interaction&page=1&page_size=20", undefined, sellerAuth.token).then((result) => {
                assert(result.data.code === 200, `閫氱煡鍒楄〃澶辫触: ${JSON.stringify(result.data)}`);
                return result.data.data.total;
            }));
        }
        assert(listTasks.length === LIST_REQUEST_COUNT, `鍒楄〃璇锋眰鏁伴噺寮傚父: ${listTasks.length}`);
        const listBatch = await runBatch("lists_fetch", listTasks);
        report.batches.lists_fetch = listBatch.summary;
        assert(listBatch.summary.failed === 0, `鍒楄〃骞跺彂璇诲彇瀛樺湪澶辫触: ${JSON.stringify(listBatch.summary.failures)}`);
        report.checked.push("列表并发读取");

        logStep("upload", "并发上传图片并校验静态访问");
        const uploadBatch = await runBatch("upload_single", Array.from({ length: UPLOAD_REQUEST_COUNT }, (_, index) => {
            return () => requestMultipart("/api/upload", sellerAuth.token, `bench-${index + 1}.png`, "image/png", uploadBuffer).then((result) => {
                assert(result.status === 200 && result.data.code === 200, `涓婁紶澶辫触: ${JSON.stringify(result.data)}`);
                return result.data.data.url;
            });
        }));
        report.batches.upload_single = uploadBatch.summary;
        assert(uploadBatch.summary.failed === 0, `骞跺彂涓婁紶瀛樺湪澶辫触: ${JSON.stringify(uploadBatch.summary.failures)}`);

        const uploadUrls = uploadBatch.raw.map((item) => item.value);
        assert(new Set(uploadUrls).size === uploadUrls.length, "涓婁紶杩斿洖浜嗛噸澶?URL");
        const staticBatch = await runBatch("upload_static_fetch", uploadUrls.map((url) => {
            return () => requestText(url).then((result) => {
                assert(result.status === 200, `闈欐€佹枃浠惰闂け璐? ${url}`);
                return result.status;
            });
        }));
        report.batches.upload_static_fetch = staticBatch.summary;
        assert(staticBatch.summary.failed === 0, `闈欐€佽闂瓨鍦ㄥけ璐? ${JSON.stringify(staticBatch.summary.failures)}`);
        report.checked.push("上传并发与静态访问");

        logStep("notification", "并发创建通知并校验已读一致性");
        const favoriteBatch = await runBatch("notification_favorite", actorAuths.map((auth) => {
            return () => requestJson("POST", `/api/products/${notificationProduct.id}/favorite`, undefined, auth.token).then((result) => {
                assert(result.data.code === 200, `鏀惰棌澶辫触: ${JSON.stringify(result.data)}`);
                return result.data.data.favorited;
            });
        }));
        report.batches.notification_favorite = favoriteBatch.summary;
        assert(favoriteBatch.summary.failed === 0, `閫氱煡鍒涘缓瀛樺湪澶辫触: ${JSON.stringify(favoriteBatch.summary.failures)}`);

        const notificationPollBatch = await runBatch("notification_poll", Array.from({ length: 10 }, () => {
            return () => requestJson("GET", "/api/messages/notifications?kind=interaction&page=1&page_size=50", undefined, sellerAuth.token).then((result) => {
                assert(result.data.code === 200, `閫氱煡杞澶辫触: ${JSON.stringify(result.data)}`);
                return result.data.data.unread_count;
            });
        }));
        report.batches.notification_poll = notificationPollBatch.summary;
        assert(notificationPollBatch.summary.failed === 0, `閫氱煡杞瀛樺湪澶辫触: ${JSON.stringify(notificationPollBatch.summary.failures)}`);

        const finalNotifications = await requestJson("GET", "/api/messages/notifications?kind=interaction&page=1&page_size=50", undefined, sellerAuth.token);
        assert(finalNotifications.data.code === 200, `鏈€缁堥€氱煡鏌ヨ澶辫触: ${JSON.stringify(finalNotifications.data)}`);
        assert(Number(finalNotifications.data.data.unread_count) === FAVORITE_ACTOR_COUNT,
            `閫氱煡鏈鏁板紓甯? ${JSON.stringify(finalNotifications.data.data)}`
        );

        const notificationReadBatch = await runBatch("notification_read", Array.from({ length: NOTIFICATION_READ_REQUEST_COUNT }, () => {
            return () => requestJson("POST", "/api/messages/notifications/read", { kind: "interaction" }, sellerAuth.token).then((result) => {
                assert(result.data.code === 200, `閫氱煡宸茶澶辫触: ${JSON.stringify(result.data)}`);
                return result.data.data.interaction_unread_count;
            });
        }));
        report.batches.notification_read = notificationReadBatch.summary;
        assert(notificationReadBatch.summary.failed === 0, `閫氱煡骞跺彂宸茶瀛樺湪澶辫触: ${JSON.stringify(notificationReadBatch.summary.failures)}`);

        const unreadAfterRead = await requestJson("GET", "/api/messages/unread", undefined, sellerAuth.token);
        assert(unreadAfterRead.data.code === 200, `閫氱煡宸茶鍚庢湭璇绘煡璇㈠け璐? ${JSON.stringify(unreadAfterRead.data)}`);
        assert(Number(unreadAfterRead.data.data.interaction_unread_count) === 0,
            `閫氱煡骞跺彂宸茶鍚庝粛鏈夋湭璇? ${JSON.stringify(unreadAfterRead.data.data)}`
        );
        report.checked.push("通知并发创建、轮询、并发已读");

        report.ok = true;
        console.log(JSON.stringify(report, null, 4));
    } finally {
        logStep("cleanup", "清理测试账号和孤儿上传文件");
        await cleanupUsers(usernames);
        try {
            await cleanupOrphanUploads(getDb());
        } finally {
            await closeDb();
        }
    }
}

main().catch((error) => {
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
});





