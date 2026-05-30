const express = require("express");
const { getDb } = require("../config/db");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

function buildUserSummary(db, currentUserId, targetUserId) {
    return db.prepare(`
        SELECT
            u.id,
            u.username,
            u.nickname,
            u.avatar_url,
            u.campus,
            u.bio,
            EXISTS(
                SELECT 1 FROM friends f
                WHERE f.user_id = ? AND f.friend_id = u.id
            ) AS is_friend
        FROM users u
        WHERE u.id = ?
    `).get(currentUserId, targetUserId);
}

router.post("/", authMiddleware, (req, res) => {
    const { receiver_id, content } = req.body;
    if (!receiver_id || !content || !content.trim()) return res.json({ code: 400, message: "请填写完整消息内容" });
    if (Number(receiver_id) === req.user.id) return res.json({ code: 400, message: "不能给自己发消息" });
    const db = getDb();
    if (!db.prepare("SELECT id FROM users WHERE id=?").get(receiver_id)) return res.json({ code: 404, message: "用户不存在" });
    const r = db.prepare("INSERT INTO messages (sender_id,receiver_id,content) VALUES (?,?,?)").run(req.user.id, receiver_id, content.trim());
    res.json({ code: 200, message: "发送成功", data: db.prepare("SELECT * FROM messages WHERE id=?").get(r.lastInsertRowid) });
});

router.get("/conversation/:userId", authMiddleware, (req, res) => {
    const db = getDb();
    const { page = 1, page_size = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(page_size);
    const msgs = db.prepare(`
        SELECT
            m.*,
            u1.nickname AS sender_name,
            u1.avatar_url AS sender_avatar,
            u2.nickname AS receiver_name,
            u2.avatar_url AS receiver_avatar
        FROM messages m
        JOIN users u1 ON m.sender_id=u1.id
        JOIN users u2 ON m.receiver_id=u2.id
        WHERE (m.sender_id=? AND m.receiver_id=?) OR (m.sender_id=? AND m.receiver_id=?)
        ORDER BY m.created_at DESC
        LIMIT ? OFFSET ?
    `).all(req.user.id, req.params.userId, req.params.userId, req.user.id, parseInt(page_size), offset);
    db.prepare("UPDATE messages SET is_read=1 WHERE receiver_id=? AND sender_id=? AND is_read=0").run(req.user.id, req.params.userId);
    res.json({ code: 200, data: { list: msgs.reverse() } });
});

router.get("/conversations", authMiddleware, (req, res) => {
    const db = getDb();
    const convs = db.prepare(`
        SELECT
            CASE WHEN m.sender_id=? THEN m.receiver_id ELSE m.sender_id END AS other_id,
            u.nickname AS other_name,
            u.avatar_url AS other_avatar,
            MAX(m.created_at) AS last_time,
            (
                SELECT content
                FROM messages m2
                WHERE (m2.sender_id=m.sender_id AND m2.receiver_id=m.receiver_id)
                   OR (m2.sender_id=m.receiver_id AND m2.receiver_id=m.sender_id)
                ORDER BY m2.created_at DESC
                LIMIT 1
            ) AS last_message,
            (
                SELECT COUNT(*)
                FROM messages m3
                WHERE m3.receiver_id=?
                  AND m3.sender_id=CASE WHEN m.sender_id=? THEN m.receiver_id ELSE m.sender_id END
                  AND m3.is_read=0
            ) AS unread_count
        FROM messages m
        JOIN users u ON u.id=CASE WHEN m.sender_id=? THEN m.receiver_id ELSE m.sender_id END
        WHERE m.sender_id=? OR m.receiver_id=?
        GROUP BY other_id
        ORDER BY last_time DESC
    `).all(req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id);
    res.json({ code: 200, data: convs });
});

router.get("/friends", authMiddleware, (req, res) => {
    const db = getDb();
    const friends = db.prepare(`
        SELECT
            u.id,
            u.username,
            u.nickname,
            u.avatar_url,
            u.campus,
            u.bio,
            (
                SELECT content
                FROM messages m
                WHERE (m.sender_id=? AND m.receiver_id=u.id) OR (m.sender_id=u.id AND m.receiver_id=?)
                ORDER BY m.created_at DESC
                LIMIT 1
            ) AS last_message,
            (
                SELECT MAX(created_at)
                FROM messages m
                WHERE (m.sender_id=? AND m.receiver_id=u.id) OR (m.sender_id=u.id AND m.receiver_id=?)
            ) AS last_time,
            (
                SELECT COUNT(*)
                FROM messages m
                WHERE m.receiver_id=? AND m.sender_id=u.id AND m.is_read=0
            ) AS unread_count
        FROM friends f
        JOIN users u ON u.id=f.friend_id
        WHERE f.user_id=?
        ORDER BY COALESCE(last_time, f.created_at) DESC, u.nickname COLLATE NOCASE ASC
    `).all(req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id);
    res.json({ code: 200, data: friends });
});

router.post("/friends/:friendId", authMiddleware, (req, res) => {
    const db = getDb();
    const friendId = Number(req.params.friendId);
    if (!friendId || friendId === req.user.id) return res.json({ code: 400, message: "好友添加无效" });
    const target = db.prepare("SELECT id FROM users WHERE id=?").get(friendId);
    if (!target) return res.json({ code: 404, message: "用户不存在" });
    const exists = db.prepare("SELECT id FROM friends WHERE user_id=? AND friend_id=?").get(req.user.id, friendId);
    if (exists) return res.json({ code: 200, message: "已是好友" });
    const addFriend = db.transaction(() => {
        db.prepare("INSERT INTO friends (user_id,friend_id) VALUES (?,?)").run(req.user.id, friendId);
        db.prepare("INSERT INTO friends (user_id,friend_id) VALUES (?,?)").run(friendId, req.user.id);
    });
    addFriend();
    res.json({ code: 200, message: "添加好友成功", data: buildUserSummary(db, req.user.id, friendId) });
});

router.get("/users/search", authMiddleware, (req, res) => {
    const db = getDb();
    const keyword = typeof req.query.keyword === "string" ? req.query.keyword.trim() : "";
    if (!keyword) return res.json({ code: 200, data: [] });
    const like = `%${keyword}%`;
    const list = db.prepare(`
        SELECT
            u.id,
            u.username,
            u.nickname,
            u.avatar_url,
            u.campus,
            u.bio,
            EXISTS(
                SELECT 1 FROM friends f
                WHERE f.user_id = ? AND f.friend_id = u.id
            ) AS is_friend
        FROM users u
        WHERE u.id != ?
          AND (u.username LIKE ? OR u.nickname LIKE ?)
        ORDER BY is_friend DESC, u.nickname COLLATE NOCASE ASC, u.username COLLATE NOCASE ASC
        LIMIT 20
    `).all(req.user.id, req.user.id, like, like);
    res.json({ code: 200, data: list });
});

router.get("/users/:id", authMiddleware, (req, res) => {
    const db = getDb();
    const user = buildUserSummary(db, req.user.id, req.params.id);
    if (!user) return res.json({ code: 404, message: "用户不存在" });
    res.json({ code: 200, data: user });
});

router.get("/unread", authMiddleware, (req, res) => {
    const db = getDb();
    const r = db.prepare("SELECT COUNT(*) AS count FROM messages WHERE receiver_id=? AND is_read=0").get(req.user.id);
    res.json({ code: 200, data: { unread_count: r.count } });
});

module.exports = router;
