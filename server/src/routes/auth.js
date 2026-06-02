const express = require("express");
const bcrypt = require("bcryptjs");
const { getDb } = require("../config/db");
const { generateToken, authMiddleware } = require("../middleware/auth");
const {
    generateVerificationCode,
    getVerificationCodeHash,
    sendVerificationEmail
} = require("../services/email");
const { getUserFacingMessage, logServerError } = require("../utils/error");
const { buildRequestMeta, logError, logInfo, logWarn } = require("../utils/logger");

const router = express.Router();

function normalizeText(value) {
    return String(value || "").trim();
}

function normalizePhone(value) {
    return normalizeText(value).replace(/\s+/g, "");
}

function normalizeEmail(value) {
    return normalizeText(value).replace(/\s+/g, "").toLowerCase();
}

function isValidPhone(phone) {
    return /^1\d{10}$/.test(phone);
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidVerificationCode(code) {
    return /^\d{6}$/.test(normalizeText(code));
}

async function withCredit(db, user) {
    const credit = await db.prepare(`
        SELECT
            COUNT(*) AS review_count,
            ROUND(COALESCE(AVG(rating), 0), 1) AS rating_avg
        FROM reviews
        WHERE reviewee_id=?
    `).get(user.id);

    return {
        ...user,
        is_admin: !!user.is_admin,
        can_moderate: !!user.can_moderate,
        must_change_password: !!user.must_change_password,
        credit: {
            review_count: credit.review_count || 0,
            rating_avg: Number(credit.rating_avg || 0)
        }
    };
}

function getPublicUserFields() {
    return "id, username, email, nickname, avatar_url, campus, bio, phone, is_admin, can_moderate, must_change_password, created_at";
}

async function getPublicUserById(db, userId) {
    const user = await db.prepare(`SELECT ${getPublicUserFields()} FROM users WHERE id=?`).get(userId);
    if (!user) {
        return null;
    }
    return withCredit(db, user);
}

async function getLatestVerificationRecord(db, contact, purpose) {
    return db.prepare(`
        SELECT
            id,
            contact,
            purpose,
            code_hash,
            verify_attempts,
            expires_at,
            consumed_at,
            last_sent_at,
            TIMESTAMPDIFF(SECOND, last_sent_at, CURRENT_TIMESTAMP) AS seconds_since_last_sent
        FROM verification_codes
        WHERE contact=? AND purpose=?
        ORDER BY id DESC
        LIMIT 1
    `).get(contact, purpose);
}

router.post("/register/send-email-code", async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const purpose = "register";

    if (!email) {
        return res.json({ code: 400, message: "请填写邮箱地址" });
    }
    if (!isValidEmail(email)) {
        return res.json({ code: 400, message: "请输入正确的邮箱地址" });
    }

    const db = getDb();
    if (await db.prepare("SELECT id FROM users WHERE email=?").get(email)) {
        logWarn("auth.email_code_rejected", "邮箱验证码发送被拒绝：邮箱已注册", buildRequestMeta(req, { email }));
        return res.json({ code: 400, message: "邮箱已被注册" });
    }

    const latest = await getLatestVerificationRecord(db, email, purpose);
    const cooldownSeconds = Number.parseInt(process.env.EMAIL_CODE_COOLDOWN_SECONDS || "60", 10);
    if (latest && latest.last_sent_at && !latest.consumed_at) {
        const secondsSinceLastSent = Number.parseInt(latest.seconds_since_last_sent, 10);
        if (Number.isFinite(secondsSinceLastSent) && secondsSinceLastSent < cooldownSeconds) {
            const remainingSeconds = Math.max(1, cooldownSeconds - Math.max(0, secondsSinceLastSent));
            logWarn("auth.email_code_rate_limited", "邮箱验证码发送过于频繁", buildRequestMeta(req, {
                email,
                remaining_seconds: remainingSeconds
            }));
            return res.status(429).json({
                code: 429,
                message: `验证码发送过于频繁，请 ${remainingSeconds} 秒后再试`
            });
        }
    }

    const code = generateVerificationCode();
    const codeHash = getVerificationCodeHash(email, purpose, code);
    const ttlSeconds = Number.parseInt(process.env.EMAIL_CODE_TTL_SECONDS || "300", 10);

    const result = await db.prepare(`
        INSERT INTO verification_codes (
            contact,
            purpose,
            code_hash,
            verify_attempts,
            send_count,
            request_ip,
            last_sent_at,
            expires_at
        ) VALUES (?, ?, ?, 0, 1, ?, CURRENT_TIMESTAMP, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? SECOND))
    `).run(email, purpose, codeHash, normalizeText(req.ip || ""), ttlSeconds);

    try {
        await sendVerificationEmail({
            contact: email,
            code,
            purpose
        });
    } catch (error) {
        await db.prepare("DELETE FROM verification_codes WHERE id=?").run(result.lastInsertRowid);
        logError("auth.email_code_send_failed", "邮箱验证码发送失败", error, buildRequestMeta(req, { email, purpose }));
        logServerError(error, "send register email code");
        return res.status(500).json({
            code: 500,
            message: getUserFacingMessage(error, "验证码发送失败，请稍后再试")
        });
    }

    return res.json({
        code: 200,
        message: "验证码已发送"
    });
});

router.post("/register", async (req, res) => {
    const username = normalizeText(req.body.username);
    const password = String(req.body.password || "");
    const nickname = normalizeText(req.body.nickname) || username;
    const email = normalizeEmail(req.body.email);

    if (!username || !password) {
        return res.json({ code: 400, message: "请填写用户名和密码" });
    }
    if (email && !isValidEmail(email)) {
        return res.json({ code: 400, message: "请输入正确的邮箱地址" });
    }
    if (password.length < 6) {
        return res.json({ code: 400, message: "密码至少需要 6 位" });
    }

    const db = getDb();
    if (await db.prepare("SELECT id FROM users WHERE username=?").get(username)) {
        logWarn("auth.register_rejected", "注册被拒绝：用户名已存在", buildRequestMeta(req, { username }));
        return res.json({ code: 400, message: "用户名已存在" });
    }
    if (email && await db.prepare("SELECT id FROM users WHERE email=?").get(email)) {
        logWarn("auth.register_rejected", "注册被拒绝：邮箱已被注册", buildRequestMeta(req, { username, email }));
        return res.json({ code: 400, message: "邮箱已被注册" });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const result = await db.prepare(`
        INSERT INTO users (username, password_hash, nickname, email)
        VALUES (?, ?, ?, ?)
    `).run(username, passwordHash, nickname, email || null);

    const user = await getPublicUserById(db, result.lastInsertRowid);
    logInfo("auth.register_succeeded", "用户注册成功", buildRequestMeta(req, {
        user_id: user.id,
        username: user.username
    }));
    return res.json({
        code: 200,
        message: "注册成功",
        data: {
            user,
            token: generateToken(user)
        }
    });
});

router.post("/login", async (req, res) => {
    const username = normalizeText(req.body.username);
    const password = String(req.body.password || "");

    if (!username || !password) {
        return res.json({ code: 400, message: "请填写用户名和密码" });
    }

    const db = getDb();
    const user = await db.prepare("SELECT * FROM users WHERE username=?").get(username);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        logWarn("auth.login_failed", "登录失败：用户名或密码错误", buildRequestMeta(req, { username }));
        return res.json({ code: 400, message: "用户名或密码错误" });
    }

    const { password_hash, ...info } = user;
    logInfo("auth.login_succeeded", "用户登录成功", buildRequestMeta(req, {
        user_id: info.id,
        username: info.username
    }));
    return res.json({
        code: 200,
        message: "登录成功",
        data: {
            user: await withCredit(db, info),
            token: generateToken(info)
        }
    });
});

router.post("/logout", authMiddleware, async (req, res) => {
    logInfo("auth.logout", "用户退出登录", buildRequestMeta(req));
    return res.json({ code: 200, message: "已退出登录" });
});

router.get("/me", authMiddleware, async (req, res) => {
    const db = getDb();
    const user = await getPublicUserById(db, req.user.id);
    if (!user) {
        return res.json({ code: 404, message: "用户不存在" });
    }

    return res.json({ code: 200, data: user });
});

router.put("/me", authMiddleware, async (req, res) => {
    const { nickname, avatar_url, campus, bio, phone, email } = req.body;
    const db = getDb();
    const fields = [];
    const values = [];

    if (nickname !== undefined) {
        fields.push("nickname=?");
        values.push(normalizeText(nickname));
    }
    if (avatar_url !== undefined) {
        fields.push("avatar_url=?");
        values.push(normalizeText(avatar_url));
    }
    if (campus !== undefined) {
        fields.push("campus=?");
        values.push(normalizeText(campus));
    }
    if (bio !== undefined) {
        fields.push("bio=?");
        values.push(normalizeText(bio));
    }
    if (phone !== undefined) {
        const normalizedPhone = normalizePhone(phone);
        if (normalizedPhone && !isValidPhone(normalizedPhone)) {
            return res.json({ code: 400, message: "请输入正确的 11 位手机号" });
        }
        fields.push("phone=?");
        values.push(normalizedPhone);
    }
    if (email !== undefined) {
        const normalizedEmail = normalizeEmail(email);
        if (normalizedEmail && !isValidEmail(normalizedEmail)) {
            return res.json({ code: 400, message: "请输入正确的邮箱地址" });
        }
        if (normalizedEmail) {
            const existingEmail = await db.prepare("SELECT id FROM users WHERE email=? AND id<>?").get(normalizedEmail, req.user.id);
            if (existingEmail) {
                return res.json({ code: 400, message: "邮箱已被其他账号绑定" });
            }
        }
        fields.push("email=?");
        values.push(normalizedEmail || null);
    }

    if (!fields.length) {
        return res.json({ code: 400, message: "没有可更新的资料" });
    }

    fields.push("updated_at=CURRENT_TIMESTAMP");
    values.push(req.user.id);

    await db.prepare(`UPDATE users SET ${fields.join(", ")} WHERE id=?`).run(...values);
    const user = await getPublicUserById(db, req.user.id);
    return res.json({ code: 200, message: "资料已更新", data: user });
});

router.post("/reset-password", authMiddleware, async (req, res) => {
    const currentPassword = String(req.body.current_password || "");
    const newPassword = String(req.body.new_password || "");

    if (!currentPassword || !newPassword) {
        return res.json({ code: 400, message: "请填写完整的密码信息" });
    }
    if (newPassword.length < 6) {
        return res.json({ code: 400, message: "新密码至少需要 6 位" });
    }

    const db = getDb();
    const user = await db.prepare("SELECT id, password_hash FROM users WHERE id=?").get(req.user.id);
    if (!user) {
        return res.json({ code: 404, message: "用户不存在" });
    }
    if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
        return res.json({ code: 400, message: "当前密码不正确" });
    }
    if (bcrypt.compareSync(newPassword, user.password_hash)) {
        return res.json({ code: 400, message: "新密码不能与当前密码相同" });
    }

    const nextHash = bcrypt.hashSync(newPassword, 10);
    await db.prepare(`
        UPDATE users
        SET password_hash=?, must_change_password=0, updated_at=CURRENT_TIMESTAMP
        WHERE id=?
    `).run(nextHash, req.user.id);

    const publicUser = await getPublicUserById(db, req.user.id);
    logInfo("auth.password_reset_succeeded", "用户已修改密码", buildRequestMeta(req));
    return res.json({
        code: 200,
        message: "密码修改成功",
        data: publicUser
    });
});

router.post("/forgot-password/request", async (req, res) => {
    const username = normalizeText(req.body.username);
    const email = normalizeEmail(req.body.email);
    const reason = normalizeText(req.body.reason);

    if (!username || !email) {
        return res.json({ code: 400, message: "请填写用户名和邮箱地址" });
    }
    if (!isValidEmail(email)) {
        return res.json({ code: 400, message: "请输入正确的邮箱地址" });
    }
    if (reason.length > 500) {
        return res.json({ code: 400, message: "情况说明不能超过 500 字" });
    }

    const db = getDb();
    const user = await db.prepare("SELECT id, username, email FROM users WHERE username=?").get(username);
    if (!user) {
        return res.json({ code: 404, message: "账号不存在" });
    }
    if (!user.email) {
        return res.json({ code: 400, message: "当前账号尚未绑定邮箱，请先到个人中心绑定邮箱" });
    }
    if (normalizeEmail(user.email) !== email) {
        return res.json({ code: 400, message: "邮箱与账号绑定信息不一致" });
    }

    const pendingRequest = await db.prepare(`
        SELECT id
        FROM password_reset_requests
        WHERE user_id=? AND status IN ('pending', 'reviewing')
        ORDER BY id DESC
        LIMIT 1
    `).get(user.id);
    if (pendingRequest) {
        return res.json({ code: 400, message: "你已存在待处理的找回申请，请先等待处理结果" });
    }

    const result = await db.prepare(`
        INSERT INTO password_reset_requests (
            user_id,
            username_snapshot,
            request_email,
            request_phone,
            resolution_note,
            reason,
            status
        ) VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `).run(user.id, user.username, email, "", "", reason);

    const requestInfo = await db.prepare(`
        SELECT id, user_id, username_snapshot, request_email, reason, status, resolution_note, created_at, handled_at
        FROM password_reset_requests
        WHERE id=?
    `).get(result.lastInsertRowid);
    logInfo("auth.password_reset_requested", "用户提交找回密码申请", buildRequestMeta(req, {
        request_id: requestInfo.id,
        username
    }));

    return res.json({
        code: 200,
        message: "找回申请已提交，请等待管理员人工核验",
        data: requestInfo
    });
});

router.post("/forgot-password/status", async (req, res) => {
    const username = normalizeText(req.body.username);
    const email = normalizeEmail(req.body.email);

    if (!username || !email) {
        return res.json({ code: 400, message: "请填写用户名和邮箱地址" });
    }
    if (!isValidEmail(email)) {
        return res.json({ code: 400, message: "请输入正确的邮箱地址" });
    }

    const db = getDb();
    const requestInfo = await db.prepare(`
        SELECT
            pr.id,
            pr.user_id,
            pr.username_snapshot,
            pr.request_email,
            pr.reason,
            pr.status,
            pr.resolution_note,
            pr.created_at,
            pr.handled_at,
            handler.nickname AS handled_by_name
        FROM password_reset_requests pr
        LEFT JOIN users handler ON handler.id=pr.handled_by
        WHERE pr.username_snapshot=? AND pr.request_email=?
        ORDER BY pr.id DESC
        LIMIT 1
    `).get(username, email);

    if (!requestInfo) {
        return res.json({ code: 404, message: "未找到对应的找回申请" });
    }

    return res.json({
        code: 200,
        data: requestInfo
    });
});

module.exports = router;
