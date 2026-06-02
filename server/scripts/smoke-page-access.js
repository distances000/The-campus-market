const http = require("http");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

const API_HOST = process.env.SMOKE_API_HOST || "127.0.0.1";
const API_PORT = Number.parseInt(process.env.SMOKE_API_PORT || "3000", 10);
const PAGE_HOST = process.env.SMOKE_PAGE_HOST || "127.0.0.1";
const PAGE_PORT = Number.parseInt(process.env.SMOKE_PAGE_PORT || "4173", 10);
const DATABASE_URL = process.env.DATABASE_URL || "mysql://root:czh814814@127.0.0.1:3306/campus_market";

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function requestJson(method, path, body, token, port = API_PORT) {
    return new Promise((resolve, reject) => {
        const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
        const req = http.request({
            hostname: API_HOST,
            port,
            path,
            method,
            headers: {
                ...(payload ? { "Content-Type": "application/json", "Content-Length": payload.length } : {}),
                ...(token ? { Authorization: `Bearer ${token}` } : {})
            }
        }, (res) => {
            let raw = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => {
                raw += chunk;
            });
            res.on("end", () => {
                try {
                    resolve({
                        status: res.statusCode,
                        data: raw ? JSON.parse(raw) : null,
                        raw
                    });
                } catch (error) {
                    reject(new Error(`Invalid JSON for ${method} ${path}: ${raw}`));
                }
            });
        });
        req.on("error", reject);
        if (payload) {
            req.write(payload);
        }
        req.end();
    });
}

function requestText(path) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: PAGE_HOST,
            port: PAGE_PORT,
            path,
            method: "GET"
        }, (res) => {
            let raw = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => {
                raw += chunk;
            });
            res.on("end", () => {
                resolve({ status: res.statusCode, body: raw });
            });
        });
        req.on("error", reject);
        req.end();
    });
}

async function cleanupUsers(usernames) {
    const db = await mysql.createConnection(DATABASE_URL);
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
        await db.query(`DELETE FROM hidden_conversations WHERE user_id IN (${idPlaceholders}) OR peer_id IN (${idPlaceholders})`, [...userIds, ...userIds]);
        await db.query(`DELETE FROM friends WHERE user_id IN (${idPlaceholders}) OR friend_id IN (${idPlaceholders})`, [...userIds, ...userIds]);
        await db.query(`DELETE FROM favorites WHERE user_id IN (${idPlaceholders})`, userIds);
        await db.query(`DELETE FROM likes WHERE user_id IN (${idPlaceholders})`, userIds);
        await db.query(`DELETE FROM comments WHERE user_id IN (${idPlaceholders})`, userIds);
        await db.query(`DELETE FROM messages WHERE sender_id IN (${idPlaceholders}) OR receiver_id IN (${idPlaceholders})`, [...userIds, ...userIds]);
        await db.query(`DELETE FROM orders WHERE buyer_id IN (${idPlaceholders}) OR seller_id IN (${idPlaceholders})`, [...userIds, ...userIds]);
        await db.query(`DELETE FROM reviews WHERE reviewer_id IN (${idPlaceholders}) OR reviewee_id IN (${idPlaceholders})`, [...userIds, ...userIds]);
        await db.query(`DELETE FROM reports WHERE reporter_id IN (${idPlaceholders}) OR target_owner_id IN (${idPlaceholders}) OR handled_by IN (${idPlaceholders})`, [...userIds, ...userIds, ...userIds]);
        await db.query(`DELETE FROM posts WHERE author_id IN (${idPlaceholders})`, userIds);
        await db.query(`DELETE FROM products WHERE seller_id IN (${idPlaceholders})`, userIds);
        await db.query(`DELETE FROM password_reset_requests WHERE user_id IN (${idPlaceholders}) OR handled_by IN (${idPlaceholders})`, [...userIds, ...userIds]);
        await db.query(`DELETE FROM users WHERE id IN (${idPlaceholders})`, userIds);
        await db.commit();
    } catch (error) {
        await db.rollback();
        throw error;
    } finally {
        await db.end();
    }
}

async function main() {
    const suffix = Date.now().toString().slice(-6);
    const usernames = [`page_user_${suffix}`, `page_admin_${suffix}`];
    const normal = {
        username: usernames[0],
        nickname: `页面用户${suffix}`,
        email: `page_user_${suffix}@example.com`,
        password: "PageUser123!"
    };
    const admin = {
        username: usernames[1],
        nickname: `页面管理员${suffix}`,
        email: `page_admin_${suffix}@example.com`,
        password: "PageAdmin123!"
    };

    const db = await mysql.createConnection(DATABASE_URL);

    try {
        await wait(1000);
        await cleanupUsers(usernames);

        const userPasswordHash = bcrypt.hashSync(normal.password, 10);
        const adminPasswordHash = bcrypt.hashSync(admin.password, 10);

        await db.query(`
            INSERT INTO users (username, password_hash, nickname, email)
            VALUES (?, ?, ?, ?)
        `, [normal.username, userPasswordHash, normal.nickname, normal.email]);

        await db.query(`
            INSERT INTO users (username, password_hash, nickname, email, is_admin, can_moderate)
            VALUES (?, ?, ?, ?, 1, 1)
        `, [admin.username, adminPasswordHash, admin.nickname, admin.email]);

        let result = await requestJson("POST", "/api/auth/login", {
            username: normal.username,
            password: normal.password
        });
        assert(result.data && result.data.code === 200, `normal login failed: ${JSON.stringify(result.data)}`);
        const normalToken = result.data.data.token;

        result = await requestJson("POST", "/api/auth/login", {
            username: admin.username,
            password: admin.password
        });
        assert(result.data && result.data.code === 200, `admin login failed: ${JSON.stringify(result.data)}`);
        const adminToken = result.data.data.token;

        result = await requestJson("POST", "/api/products", {
            title: "页面检查商品",
            description: "用于页面访问冒烟",
            price: 88,
            original_price: 99,
            category: "other",
            condition: "used",
            campus: "main",
            images_json: "[]"
        }, normalToken);
        assert(result.data && result.data.code === 200, `create product failed: ${JSON.stringify(result.data)}`);
        const productId = result.data.data.id;

        result = await requestJson("POST", "/api/posts", {
            content: "页面检查帖子",
            images_json: "[]",
            campus: "main"
        }, normalToken);
        assert(result.data && result.data.code === 200, `create post failed: ${JSON.stringify(result.data)}`);
        const postId = result.data.data.id;

        const pageChecks = [];
        for (const path of ["/home", `/product/${productId}`, `/post/${postId}`, "/messages", "/profile", "/publish", "/moderation/reports"]) {
            const page = await requestText(path);
            assert(page.status === 200, `page ${path} status ${page.status}`);
            assert(/<div id="app"><\/div>/.test(page.body), `page ${path} missing app shell`);
            pageChecks.push({ path, status: page.status, shell: true });
        }

        const apiChecks = [];
        for (const [path, token] of [
            ["/api/auth/me", normalToken],
            [`/api/products/${productId}`, normalToken],
            [`/api/posts/${postId}`, normalToken],
            ["/api/messages/conversations", normalToken],
            ["/api/products/my/list", normalToken],
            ["/api/moderation/reports", adminToken]
        ]) {
            const apiResult = await requestJson("GET", path, undefined, token);
            assert(apiResult.data && apiResult.data.code === 200, `${path} failed: ${JSON.stringify(apiResult.data)}`);
            apiChecks.push({ path, status: apiResult.status });
        }

        console.log(JSON.stringify({
            ok: true,
            pageChecks,
            apiChecks
        }, null, 2));
    } finally {
        await db.end();
        await cleanupUsers(usernames);
    }
}

main().catch((error) => {
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
});
