const express = require("express");
const bcrypt = require("bcryptjs");
const { getDb } = require("../config/db");
const { generateToken, authMiddleware } = require("../middleware/auth");
const {
    generateVerificationCode,
    getVerificationCodeHash,
    sendVerificationEmail
} = require("../services/email");

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
        SELECT id, contact, purpose, code_hash, verify_attempts, expires_at, consumed_at, last_sent_at
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
        return res.json({ code: 400, message: "邮箱已被注册" });
    }

    const latest = await getLatestVerificationRecord(db, email, purpose);
    const cooldownSeconds = Number.parseInt(process.env.EMAIL_CODE_COOLDOWN_SECONDS || "60", 10);
    if (latest && latest.last_sent_at && !latest.consumed_at) {
        const lastSentAt = new Date(latest.last_sent_at).getTime();
        if (!Number.isNaN(lastSentAt) && Date.now() - lastSentAt < cooldownSeconds * 1000) {
            const remainingSeconds = Math.max(1, cooldownSeconds - Math.floor((Date.now() - lastSentAt) / 1000));
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
        return res.status(500).json({
            code: 500,
            message: error.message || "验证码邮件发送失败"
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
    const emailCode = normalizeText(req.body.email_code || req.body.emailCode);

    if (!username || !password) {
        return res.json({ code: 400, message: "请填写用户名和密码" });
    }
    if (!email) {
        return res.json({ code: 400, message: "请填写邮箱地址" });
    }
    if (!isValidEmail(email)) {
        return res.json({ code: 400, message: "请输入正确的邮箱地址" });
    }
    if (!emailCode) {
        return res.json({ code: 400, message: "请填写邮箱验证码" });
    }
    if (!isValidVerificationCode(emailCode)) {
        return res.json({ code: 400, message: "请输入 6 位邮箱验证码" });
    }
    if (password.length < 6) {
        return res.json({ code: 400, message: "密码至少需要 6 位" });
    }

    const db = getDb();
    if (await db.prepare("SELECT id FROM users WHERE username=?").get(username)) {
        return res.json({ code: 400, message: "用户名已存在" });
    }
    if (await db.prepare("SELECT id FROM users WHERE email=?").get(email)) {
        return res.json({ code: 400, message: "邮箱已被注册" });
    }

    const verification = await getLatestVerificationRecord(db, email, "register");
    if (!verification) {
        return res.json({ code: 400, message: "请先获取邮箱验证码" });
    }
    if (verification.consumed_at) {
        return res.json({ code: 400, message: "邮箱验证码已使用，请重新获取" });
    }
    if (verification.expires_at && new Date(verification.expires_at).getTime() < Date.now()) {
        return res.json({ code: 400, message: "邮箱验证码已过期，请重新获取" });
    }
    if (verification.code_hash !== getVerificationCodeHash(email, "register", emailCode)) {
        const nextAttempts = Number(verification.verify_attempts || 0) + 1;
        await db.prepare(`
            UPDATE verification_codes
            SET verify_attempts=?, updated_at=CURRENT_TIMESTAMP
            WHERE id=?
        `).run(nextAttempts, verification.id);
        if (nextAttempts >= 5) {
            await db.prepare(`
                UPDATE verification_codes
                SET consumed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
                WHERE id=?
            `).run(verification.id);
        }
        return res.json({ code: 400, message: "邮箱验证码不正确" });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const result = await db.prepare(`
        INSERT INTO users (username, password_hash, nickname, email)
        VALUES (?, ?, ?, ?)
    `).run(username, passwordHash, nickname, email);

    await db.prepare(`
        UPDATE verification_codes
        SET consumed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
        WHERE id=?
    `).run(verification.id);

    const user = await getPublicUserById(db, result.lastInsertRowid);
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
        return res.json({ code: 400, message: "用户名或密码错误" });
    }

    const { password_hash, ...info } = user;
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
    const { nickname, avatar_url, campus, bio, phone } = req.body;
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
    return res.json({
        code: 200,
        message: "密码修改成功",
        data: publicUser
    });
});

router.post("/forgot-password/request", async (req, res) => {
    const username = normalizeText(req.body.username);
    const phone = normalizePhone(req.body.phone);
    const reason = normalizeText(req.body.reason);

    if (!username || !phone) {
        return res.json({ code: 400, message: "请填写用户名和手机号" });
    }
    if (!isValidPhone(phone)) {
        return res.json({ code: 400, message: "请输入正确的 11 位手机号" });
    }
    if (reason.length > 500) {
        return res.json({ code: 400, message: "情况说明不能超过 500 字" });
    }

    const db = getDb();
    const user = await db.prepare("SELECT id, username, nickname, phone FROM users WHERE username=?").get(username);
    if (!user) {
        return res.json({ code: 404, message: "账号不存在" });
    }
    if (user.phone && normalizePhone(user.phone) !== phone) {
        return res.json({ code: 400, message: "手机号与账号绑定信息不一致" });
    }

    const pendingRequest = await db.prepare(`
        SELECT id
        FROM password_reset_requests
        WHERE user_id=? AND status IN ('pending', 'reviewing')
        ORDER BY id DESC
        LIMIT 1
    `).get(user.id);
    if (pendingRequest) {
        return res.json({ code: 400, message: "你已有待处理的找回申请，请先等待处理结果" });
    }

    const result = await db.prepare(`
        INSERT INTO password_reset_requests (
            user_id,
            username_snapshot,
            request_phone,
            resolution_note,
            reason,
            status
        ) VALUES (?, ?, ?, ?, ?, 'pending')
    `).run(user.id, user.username, phone, "", reason);

    const requestInfo = await db.prepare(`
        SELECT id, user_id, username_snapshot, request_phone, reason, status, resolution_note, created_at, handled_at
        FROM password_reset_requests
        WHERE id=?
    `).get(result.lastInsertRowid);

    return res.json({
        code: 200,
        message: "找回申请已提交，请等待管理员人工核验",
        data: requestInfo
    });
});

router.post("/forgot-password/status", async (req, res) => {
    const username = normalizeText(req.body.username);
    const phone = normalizePhone(req.body.phone);

    if (!username || !phone) {
        return res.json({ code: 400, message: "请填写用户名和手机号" });
    }

    const db = getDb();
    const requestInfo = await db.prepare(`
        SELECT
            pr.id,
            pr.user_id,
            pr.username_snapshot,
            pr.request_phone,
            pr.reason,
            pr.status,
            pr.resolution_note,
            pr.created_at,
            pr.handled_at,
            handler.nickname AS handled_by_name
        FROM password_reset_requests pr
        LEFT JOIN users handler ON handler.id=pr.handled_by
        WHERE pr.username_snapshot=? AND pr.request_phone=?
        ORDER BY pr.id DESC
        LIMIT 1
    `).get(username, phone);

    if (!requestInfo) {
        return res.json({ code: 404, message: "未找到对应的找回申请" });
    }

    return res.json({
        code: 200,
        data: requestInfo
    });
});

module.exports = router;
