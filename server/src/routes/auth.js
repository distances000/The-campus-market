const express = require("express");
const bcrypt = require("bcryptjs");
const { getDb } = require("../config/db");
const { generateToken, authMiddleware } = require("../middleware/auth");
const router = express.Router();

router.post("/register", (req, res) => {
    const { username, password, nickname } = req.body;
    if (!username || !password) return res.json({ code: 400, message: "??????????" });
    if (password.length < 6) return res.json({ code: 400, message: "????6?" });
    const db = getDb();
    if (db.prepare("SELECT id FROM users WHERE username = ?").get(username))
        return res.json({ code: 400, message: "???????" });
    const hash = bcrypt.hashSync(password, 10);
    const r = db.prepare("INSERT INTO users (username, password_hash, nickname) VALUES (?,?,?)")
        .run(username, hash, nickname || username);
    const user = db.prepare("SELECT id,username,nickname,avatar_url,campus FROM users WHERE id=?").get(r.lastInsertRowid);
    res.json({ code: 200, message: "????", data: { user, token: generateToken(user) } });
});

router.post("/login", (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.json({ code: 400, message: "??????????" });
    const db = getDb();
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
    if (!user || !bcrypt.compareSync(password, user.password_hash))
        return res.json({ code: 400, message: "????????" });
    const { password_hash, ...info } = user;
    res.json({ code: 200, message: "????", data: { user: info, token: generateToken(info) } });
});

router.get("/me", authMiddleware, (req, res) => {
    const db = getDb();
    const user = db.prepare("SELECT id,username,nickname,avatar_url,campus,bio,phone,created_at FROM users WHERE id=?")
        .get(req.user.id);
    if (!user) return res.json({ code: 404, message: "?????" });
    res.json({ code: 200, data: user });
});

router.put("/me", authMiddleware, (req, res) => {
    const { nickname, avatar_url, campus, bio, phone } = req.body;
    const db = getDb();
    const fields = [], vals = [];
    if (nickname !== undefined) { fields.push("nickname=?"); vals.push(nickname); }
    if (avatar_url !== undefined) { fields.push("avatar_url=?"); vals.push(avatar_url); }
    if (campus !== undefined) { fields.push("campus=?"); vals.push(campus); }
    if (bio !== undefined) { fields.push("bio=?"); vals.push(bio); }
    if (phone !== undefined) { fields.push("phone=?"); vals.push(phone); }
    if (!fields.length) return res.json({ code: 400, message: "????????" });
    fields.push("updated_at=CURRENT_TIMESTAMP"); vals.push(req.user.id);
    db.prepare("UPDATE users SET " + fields.join(",") + " WHERE id=?").run(...vals);
    const user = db.prepare("SELECT id,username,nickname,avatar_url,campus,bio,phone,created_at FROM users WHERE id=?")
        .get(req.user.id);
    res.json({ code: 200, message: "????", data: user });
});

module.exports = router;