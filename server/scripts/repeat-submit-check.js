const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");
const {
    buildJsonRequest,
    getDatabaseUrl,
    waitForApiReady
} = require("./shared");

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function expectCode(result, expectedCode, step) {
    assert(result && result.data && result.data.code === expectedCode, `${step} failed: ${JSON.stringify(result && result.data)}`);
}

function logStep(step, detail) {
    console.log(`[${step}] ${detail}`);
}

async function createDbConnection() {
    return mysql.createConnection(getDatabaseUrl());
}

async function cleanupUsers(usernames) {
    const db = await createDbConnection();
    try {
        const placeholders = usernames.map(() => "?").join(",");
        const [rows] = await db.query(`SELECT id FROM users WHERE username IN (${placeholders})`, usernames);
        const userIds = rows.map((row) => row.id);
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

async function createAdminUser(user) {
    const db = await createDbConnection();
    try {
        const passwordHash = bcrypt.hashSync(user.password, 10);
        await db.query("DELETE FROM users WHERE username=?", [user.username]);
        await db.query(`
            INSERT INTO users (username, password_hash, nickname, email, is_admin, can_moderate)
            VALUES (?, ?, ?, ?, 1, 1)
        `, [user.username, passwordHash, user.nickname, user.email]);
    } finally {
        await db.end();
    }
}

async function registerUser(user) {
    const result = await buildJsonRequest("POST", "/api/auth/register", {
        username: user.username,
        password: user.password,
        nickname: user.nickname,
        email: user.email
    });
    expectCode(result, 200, `register ${user.username}`);
}

async function loginUser(user) {
    const result = await buildJsonRequest("POST", "/api/auth/login", {
        username: user.username,
        password: user.password
    });
    expectCode(result, 200, `login ${user.username}`);
    return result.data.data;
}

async function main() {
    await waitForApiReady({ timeoutMs: 30000, intervalMs: 1000 });

    const suffix = Date.now().toString().slice(-6);
    const users = {
        seller: {
            username: `repeat_seller_${suffix}`,
            nickname: `repeat-seller-${suffix}`,
            email: `repeat_seller_${suffix}@example.com`,
            password: "Seller1234!"
        },
        buyer: {
            username: `repeat_buyer_${suffix}`,
            nickname: `repeat-buyer-${suffix}`,
            email: `repeat_buyer_${suffix}@example.com`,
            password: "Buyer1234!"
        },
        bootstrapCandidate: {
            username: `repeat_bootstrap_${suffix}`,
            nickname: `repeat-bootstrap-${suffix}`,
            email: `repeat_bootstrap_${suffix}@example.com`,
            password: "Bootstrap1234!"
        },
        existingAdmin: {
            username: `repeat_admin_${suffix}`,
            nickname: `repeat-admin-${suffix}`,
            email: `repeat_admin_${suffix}@example.com`,
            password: "Admin1234!"
        }
    };
    const usernames = Object.values(users).map((item) => item.username);
    const report = {
        ok: true,
        checked: []
    };

    try {
        logStep("setup", "clean stale repeat-submit fixtures");
        await cleanupUsers(usernames);

        logStep("setup", "register and login test users");
        await registerUser(users.seller);
        await registerUser(users.buyer);
        await registerUser(users.bootstrapCandidate);

        const sellerAuth = await loginUser(users.seller);
        const buyerAuth = await loginUser(users.buyer);
        const bootstrapAuth = await loginUser(users.bootstrapCandidate);

        logStep("product", "verify duplicate product submission is blocked");
        const productPayload = {
            title: `repeat-product-${suffix}`,
            description: "duplicate product guard",
            price: 88,
            original_price: 99,
            category: "other",
            condition: "used",
            campus: "main",
            images_json: "[]"
        };
        let result = await buildJsonRequest("POST", "/api/products", productPayload, sellerAuth.token);
        expectCode(result, 200, "create product first time");
        const productId = result.data.data.id;

        result = await buildJsonRequest("POST", "/api/products", productPayload, sellerAuth.token);
        assert(result.data.code === 400, `duplicate product should be rejected: ${JSON.stringify(result.data)}`);
        report.checked.push("重复发商品");

        logStep("post", "verify duplicate post submission is blocked");
        const postPayload = {
            content: `repeat-post-${suffix}`,
            images_json: "[]",
            campus: "main"
        };
        result = await buildJsonRequest("POST", "/api/posts", postPayload, sellerAuth.token);
        expectCode(result, 200, "create post first time");

        result = await buildJsonRequest("POST", "/api/posts", postPayload, sellerAuth.token);
        assert(result.data.code === 400, `duplicate post should be rejected: ${JSON.stringify(result.data)}`);
        report.checked.push("重复发帖子");

        logStep("message", "verify duplicate message submission is blocked");
        const messagePayload = {
            receiver_id: sellerAuth.user.id,
            content: `repeat-message-${suffix}`
        };
        result = await buildJsonRequest("POST", "/api/messages", messagePayload, buyerAuth.token);
        expectCode(result, 200, "send message first time");

        result = await buildJsonRequest("POST", "/api/messages", messagePayload, buyerAuth.token);
        assert(result.data.code === 400, `duplicate message should be rejected: ${JSON.stringify(result.data)}`);
        report.checked.push("重复发消息");

        logStep("report", "verify duplicate report submission is blocked");
        result = await buildJsonRequest("POST", "/api/reports", {
            target_type: "product",
            target_id: productId,
            reason: "misleading",
            description: "duplicate report guard"
        }, buyerAuth.token);
        expectCode(result, 200, "create report first time");

        result = await buildJsonRequest("POST", "/api/reports", {
            target_type: "product",
            target_id: productId,
            reason: "misleading",
            description: "duplicate report guard"
        }, buyerAuth.token);
        assert(result.data.code === 400, `duplicate report should be rejected: ${JSON.stringify(result.data)}`);
        report.checked.push("重复提交举报");

        logStep("password-reset", "verify duplicate forgot-password request is blocked");
        result = await buildJsonRequest("POST", "/api/auth/forgot-password/request", {
            username: users.seller.username,
            email: users.seller.email,
            reason: "repeat submit guard"
        });
        expectCode(result, 200, "create password reset request first time");

        result = await buildJsonRequest("POST", "/api/auth/forgot-password/request", {
            username: users.seller.username,
            email: users.seller.email,
            reason: "repeat submit guard"
        });
        assert(result.data.code === 400, `duplicate password reset request should be rejected: ${JSON.stringify(result.data)}`);
        report.checked.push("重复提交找回密码申请");

        logStep("bootstrap", "verify bootstrap-admin duplicate initialization is blocked");
        const bootstrapKey = String(process.env.ADMIN_BOOTSTRAP_KEY || "").trim();
        assert(bootstrapKey, "ADMIN_BOOTSTRAP_KEY is required for repeat-submit bootstrap test");
        await createAdminUser(users.existingAdmin);

        result = await buildJsonRequest("POST", "/api/setup/bootstrap-admin", {
            bootstrap_key: bootstrapKey
        }, bootstrapAuth.token);
        assert(result.status === 403 && result.data.code === 403,
            `bootstrap-admin should be rejected when admin exists: ${JSON.stringify(result.data)}`
        );
        report.checked.push("管理员初始化");

        console.log(JSON.stringify(report, null, 2));
    } finally {
        await cleanupUsers(usernames);
        logStep("cleanup", "clean repeat-submit fixtures");
    }
}

main().catch((error) => {
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
});
