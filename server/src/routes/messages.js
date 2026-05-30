const express = require("express");
const { getDb } = require("../config/db");
const { authMiddleware } = require("../middleware/auth");
const router = express.Router();

router.post("/", authMiddleware, (req, res) => {
    const { receiver_id, content } = req.body;
    if (!receiver_id || !content || !content.trim()) return res.json({ code: 400, message: "??????????" });
    const db = getDb();
    if (!db.prepare("SELECT id FROM users WHERE id=?").get(receiver_id)) return res.json({ code: 404, message: "?????" });
    const r = db.prepare("INSERT INTO messages (sender_id,receiver_id,content) VALUES (?,?,?)").run(req.user.id, receiver_id, content);
    res.json({ code: 200, message: "????", data: db.prepare("SELECT * FROM messages WHERE id=?").get(r.lastInsertRowid) });
});

router.get("/conversation/:userId", authMiddleware, (req, res) => {
    const db = getDb();
    const { page=1, page_size=50 } = req.query;
    const offset = (parseInt(page)-1)*parseInt(page_size);
    const msgs = db.prepare("SELECT m.*,u1.nickname AS sender_name,u1.avatar_url AS sender_avatar,u2.nickname AS receiver_name,u2.avatar_url AS receiver_avatar FROM messages m JOIN users u1 ON m.sender_id=u1.id JOIN users u2 ON m.receiver_id=u2.id WHERE (m.sender_id=? AND m.receiver_id=?) OR (m.sender_id=? AND m.receiver_id=?) ORDER BY m.created_at DESC LIMIT ? OFFSET ?")
        .all(req.user.id, req.params.userId, req.params.userId, req.user.id, parseInt(page_size), offset);
    db.prepare("UPDATE messages SET is_read=1 WHERE receiver_id=? AND sender_id=? AND is_read=0").run(req.user.id, req.params.userId);
    res.json({ code: 200, data: { list: msgs.reverse() } });
});

router.get("/conversations", authMiddleware, (req, res) => {
    const db = getDb();
    const convs = db.prepare("SELECT CASE WHEN m.sender_id=? THEN m.receiver_id ELSE m.sender_id END AS other_id, u.nickname AS other_name, u.avatar_url AS other_avatar, MAX(m.created_at) AS last_time, (SELECT content FROM messages m2 WHERE (m2.sender_id=m.sender_id AND m2.receiver_id=m.receiver_id) OR (m2.sender_id=m.receiver_id AND m2.receiver_id=m.sender_id) ORDER BY m2.created_at DESC LIMIT 1) AS last_message, (SELECT COUNT(*) FROM messages m3 WHERE m3.receiver_id=? AND m3.sender_id=CASE WHEN m.sender_id=? THEN m.receiver_id ELSE m.sender_id END AND m3.is_read=0) AS unread_count FROM messages m JOIN users u ON u.id=CASE WHEN m.sender_id=? THEN m.receiver_id ELSE m.sender_id END WHERE m.sender_id=? OR m.receiver_id=? GROUP BY other_id ORDER BY last_time DESC")
        .all(req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id);
    res.json({ code: 200, data: convs });
});

router.get("/unread", authMiddleware, (req, res) => {
    const db = getDb();
    const r = db.prepare("SELECT COUNT(*) AS count FROM messages WHERE receiver_id=? AND is_read=0").get(req.user.id);
    res.json({ code: 200, data: { unread_count: r.count } });
});

module.exports = router;