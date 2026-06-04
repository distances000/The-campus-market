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

async function main() {
    await waitForApiReady({ timeoutMs: 30000, intervalMs: 1000 });

    const suffix = Date.now().toString().slice(-6);
    const usernames = [
        `auth_user_${suffix}`,
        `auth_admin_${suffix}`
    ];
    const user = {
        username: usernames[0],
        nickname: `改密用户${suffix}`,
        email: `auth_user_${suffix}@example.com`,
        password: "AuthUser123!",
        nextPassword: "AuthUser456!",
        finalPassword: "AuthUser789!",
        reason: "用于验证找回密码和改密链路"
    };
    const admin = {
        username: usernames[1],
        nickname: `改密管理员${suffix}`,
        email: `auth_admin_${suffix}@example.com`,
        password: "AuthAdmin123!",
        tempPassword: "TempPass123!"
    };

    try {
        logStep("setup", "清理旧的认证测试数据");
        await cleanupUsers(usernames);

        logStep("auth", "注册并登录普通账号");
        let result = await buildJsonRequest("POST", "/api/auth/register", {
            username: user.username,
            password: user.password,
            nickname: user.nickname,
            email: user.email
        });
        expectCode(result, 200, "register user");

        result = await buildJsonRequest("POST", "/api/auth/login", {
            username: user.username,
            password: user.password
        });
        expectCode(result, 200, "login user");
        const userToken = result.data.data.token;

        logStep("auth", "修改密码并验证旧密码失效");
        result = await buildJsonRequest("POST", "/api/auth/reset-password", {
            current_password: user.password,
            new_password: user.nextPassword
        }, userToken);
        expectCode(result, 200, "reset password");

        const oldLogin = await buildJsonRequest("POST", "/api/auth/login", {
            username: user.username,
            password: user.password
        });
        assert(oldLogin.data.code === 400, "old password should be rejected after reset");

        result = await buildJsonRequest("POST", "/api/auth/login", {
            username: user.username,
            password: user.nextPassword
        });
        expectCode(result, 200, "login with new password");
        assert(!result.data.data.user.must_change_password, "user should not be forced to change password after self reset");

        logStep("reset", "提交找回密码申请并验证待处理状态");
        result = await buildJsonRequest("POST", "/api/auth/forgot-password/request", {
            username: user.username,
            email: user.email,
            reason: user.reason
        });
        expectCode(result, 200, "request password reset");
        const requestId = result.data.data.id;

        result = await buildJsonRequest("POST", "/api/auth/forgot-password/status", {
            username: user.username,
            email: user.email
        });
        expectCode(result, 200, "check pending password reset status");
        assert(result.data.data.status === "pending", "password reset request should be pending");

        logStep("admin", "创建管理员账号并处理找回工单");
        await createAdminUser(admin);

        result = await buildJsonRequest("POST", "/api/auth/login", {
            username: admin.username,
            password: admin.password
        });
        expectCode(result, 200, "login admin");
        const adminToken = result.data.data.token;

        result = await buildJsonRequest("GET", "/api/moderation/password-resets?page=1&page_size=20", undefined, adminToken);
        expectCode(result, 200, "list password resets");
        assert((result.data.data.list || []).some((item) => Number(item.id) === Number(requestId)), "password reset request should be visible to admin");

        result = await buildJsonRequest("PATCH", `/api/moderation/password-resets/${requestId}`, {
            status: "resolved",
            resolution_note: "已核验账号归属，现已重置临时密码",
            new_password: admin.tempPassword
        }, adminToken);
        expectCode(result, 200, "resolve password reset");

        result = await buildJsonRequest("POST", "/api/auth/forgot-password/status", {
            username: user.username,
            email: user.email
        });
        expectCode(result, 200, "check resolved password reset status");
        assert(result.data.data.status === "resolved", "password reset request should be resolved");

        logStep("auth", "验证临时密码登录和强制改密");
        result = await buildJsonRequest("POST", "/api/auth/login", {
            username: user.username,
            password: admin.tempPassword
        });
        expectCode(result, 200, "login with temp password");
        assert(result.data.data.user.must_change_password, "temp password login should force password change");
        const tempToken = result.data.data.token;

        result = await buildJsonRequest("POST", "/api/auth/reset-password", {
            current_password: admin.tempPassword,
            new_password: user.finalPassword
        }, tempToken);
        expectCode(result, 200, "reset temp password to final");

        result = await buildJsonRequest("POST", "/api/auth/login", {
            username: user.username,
            password: user.finalPassword
        });
        expectCode(result, 200, "login with final password");
        assert(!result.data.data.user.must_change_password, "final password login should not force password change");

        console.log(JSON.stringify({
            ok: true,
            checked: [
                "注册/登录",
                "改密",
                "找回密码申请",
                "后台处理找回密码",
                "临时密码登录",
                "强制改密"
            ]
        }, null, 2));
    } finally {
        await cleanupUsers(usernames);
        logStep("cleanup", "清理认证测试数据");
    }
}

main().catch((error) => {
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
});
