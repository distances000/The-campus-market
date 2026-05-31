const express = require("express");
const bcrypt = require("bcryptjs");
const { getDb } = require("../config/db");
const { generateToken, authMiddleware } = require("../middleware/auth");

const router = express.Router();

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
        credit: {
            review_count: credit.review_count || 0,
            rating_avg: Number(credit.rating_avg || 0)
        }
    };
}

function getPublicUserFields() {
    return "id, username, nickname, avatar_url, campus, bio, phone, is_admin, created_at";
}

router.post("/register", async (req, res) => {
    const { username, password, nickname } = req.body;
    if (!username || !password) {
        return res.json({ code: 400, message: "请填写用户名和密码" });
    }
    if (password.length < 6) {
        return res.json({ code: 400, message: "密码至少需要 6 位" });
    }

    const db = getDb();
    if (await db.prepare("SELECT id FROM users WHERE username=?").get(username)) {
        return res.json({ code: 400, message: "用户名已存在" });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const result = await db.prepare(`
        INSERT INTO users (username, password_hash, nickname)
        VALUES (?, ?, ?)
    `).run(username, passwordHash, nickname || username);

    const user = await db.prepare(`SELECT ${getPublicUserFields()} FROM users WHERE id=?`).get(result.lastInsertRowid);
    return res.json({
        code: 200,
        message: "注册成功",
        data: {
            user: await withCredit(db, user),
            token: generateToken(user)
        }
    });
});

router.post("/login", async (req, res) => {
    const { username, password } = req.body;
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

router.get("/me", authMiddleware, async (req, res) => {
    const db = getDb();
    const user = await db.prepare(`SELECT ${getPublicUserFields()} FROM users WHERE id=?`).get(req.user.id);
    if (!user) {
        return res.json({ code: 404, message: "用户不存在" });
    }

    return res.json({ code: 200, data: await withCredit(db, user) });
});

router.put("/me", authMiddleware, async (req, res) => {
    const { nickname, avatar_url, campus, bio, phone } = req.body;
    const db = getDb();
    const fields = [];
    const values = [];

    if (nickname !== undefined) {
        fields.push("nickname=?");
        values.push(nickname);
    }
    if (avatar_url !== undefined) {
        fields.push("avatar_url=?");
        values.push(avatar_url);
    }
    if (campus !== undefined) {
        fields.push("campus=?");
        values.push(campus);
    }
    if (bio !== undefined) {
        fields.push("bio=?");
        values.push(bio);
    }
    if (phone !== undefined) {
        fields.push("phone=?");
        values.push(phone);
    }

    if (!fields.length) {
        return res.json({ code: 400, message: "没有可更新的资料" });
    }

    fields.push("updated_at=CURRENT_TIMESTAMP");
    values.push(req.user.id);

    await db.prepare(`UPDATE users SET ${fields.join(", ")} WHERE id=?`).run(...values);
    const user = await db.prepare(`SELECT ${getPublicUserFields()} FROM users WHERE id=?`).get(req.user.id);
    return res.json({ code: 200, message: "资料已更新", data: await withCredit(db, user) });
});

router.post("/reset-password", authMiddleware, async (req, res) => {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
        return res.json({ code: 400, message: "请填写完整的密码信息" });
    }
    if (new_password.length < 6) {
        return res.json({ code: 400, message: "新密码至少需要 6 位" });
    }

    const db = getDb();
    const user = await db.prepare("SELECT id, password_hash FROM users WHERE id=?").get(req.user.id);
    if (!user) {
        return res.json({ code: 404, message: "用户不存在" });
    }
    if (!bcrypt.compareSync(current_password, user.password_hash)) {
        return res.json({ code: 400, message: "当前密码不正确" });
    }
    if (bcrypt.compareSync(new_password, user.password_hash)) {
        return res.json({ code: 400, message: "新密码不能与当前密码相同" });
    }

    const nextHash = bcrypt.hashSync(new_password, 10);
    await db.prepare("UPDATE users SET password_hash=?, updated_at=CURRENT_TIMESTAMP WHERE id=?").run(nextHash, req.user.id);
    return res.json({ code: 200, message: "密码修改成功" });
});

module.exports = router;
