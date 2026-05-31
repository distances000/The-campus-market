const express = require("express");
const { getDb } = require("../config/db");
const { authMiddleware, optionalAuth } = require("../middleware/auth");
const { createNotification } = require("../utils/notifications");
const router = express.Router();

router.post("/", authMiddleware, (req, res) => {
    const { content, images_json, campus } = req.body;
    if (!content || !content.trim()) return res.json({ code: 400, message: "??????" });
    const db = getDb();
    const r = db.prepare("INSERT INTO posts (author_id,content,images_json,campus) VALUES (?,?,?,?)")
        .run(req.user.id, content, images_json||"[]", campus||"");
    const post = db.prepare("SELECT p.*,u.nickname AS author_name,u.avatar_url AS author_avatar FROM posts p JOIN users u ON p.author_id=u.id WHERE p.id=?")
        .get(r.lastInsertRowid);
    post.images = JSON.parse(post.images_json); delete post.images_json;
    res.json({ code: 200, message: "????", data: post });
});

router.get("/", optionalAuth, (req, res) => {
    const { campus, page=1, page_size=20 } = req.query;
    const db = getDb();
    const conds=[], params=[];
    if (campus && campus!=="all") { conds.push("p.campus=?"); params.push(campus); }
    const where = conds.length ? "WHERE "+conds.join(" AND ") : "";
    const pg=parseInt(page), ps=parseInt(page_size), offset=(pg-1)*ps;
    const total = db.prepare("SELECT COUNT(*) AS count FROM posts p "+where).get(...params).count;
    const list = db.prepare("SELECT p.*,u.nickname AS author_name,u.avatar_url AS author_avatar FROM posts p JOIN users u ON p.author_id=u.id "+where+" ORDER BY p.created_at DESC LIMIT ? OFFSET ?")
        .all(...params, ps, offset).map(p=>{
            p.images=JSON.parse(p.images_json); delete p.images_json;
            p.is_liked = req.user ? !!db.prepare("SELECT id FROM likes WHERE user_id=? AND post_id=?").get(req.user.id, p.id) : false;
            return p;
        });
    res.json({ code: 200, data: { list, total, page: pg, page_size: ps } });
});

router.get("/:id", optionalAuth, (req, res) => {
    const db = getDb();
    const post = db.prepare("SELECT p.*,u.nickname AS author_name,u.avatar_url AS author_avatar FROM posts p JOIN users u ON p.author_id=u.id WHERE p.id=?")
        .get(req.params.id);
    if (!post) return res.json({ code: 404, message: "?????" });
    post.images = JSON.parse(post.images_json); delete post.images_json;
    post.comments = db.prepare("SELECT c.*,u.nickname AS user_name,u.avatar_url AS user_avatar FROM comments c JOIN users u ON c.user_id=u.id WHERE c.post_id=? ORDER BY c.created_at ASC")
        .all(post.id);
    post.is_liked = req.user ? !!db.prepare("SELECT id FROM likes WHERE user_id=? AND post_id=?").get(req.user.id, post.id) : false;
    res.json({ code: 200, data: post });
});

router.post("/:id/like", authMiddleware, (req, res) => {
    const db = getDb();
    const post = db.prepare("SELECT id, author_id, content FROM posts WHERE id=?").get(req.params.id);
    if (!post)
        return res.json({ code: 404, message: "?????" });
    const like = db.prepare("SELECT id FROM likes WHERE user_id=? AND post_id=?").get(req.user.id, req.params.id);
    if (like) {
        db.prepare("DELETE FROM likes WHERE user_id=? AND post_id=?").run(req.user.id, req.params.id);
        db.prepare("UPDATE posts SET likes_count=likes_count-1 WHERE id=?").run(req.params.id);
        res.json({ code: 200, message: "?????", data: { liked: false } });
    } else {
        db.prepare("INSERT INTO likes (user_id,post_id) VALUES (?,?)").run(req.user.id, req.params.id);
        db.prepare("UPDATE posts SET likes_count=likes_count+1 WHERE id=?").run(req.params.id);
        createNotification(db, {
            userId: post.author_id,
            actorId: req.user.id,
            kind: "interaction",
            eventType: "post_liked",
            title: "有人赞了你的校园墙",
            content: post.content ? post.content.slice(0, 36) : "点击查看帖子详情",
            objectType: "post",
            objectId: Number(req.params.id)
        });
        res.json({ code: 200, message: "????", data: { liked: true } });
    }
});

router.post("/:id/comment", authMiddleware, (req, res) => {
    const { content } = req.body;
    if (!content || !content.trim()) return res.json({ code: 400, message: "??????" });
    const db = getDb();
    const post = db.prepare("SELECT id, author_id, content FROM posts WHERE id=?").get(req.params.id);
    if (!post)
        return res.json({ code: 404, message: "?????" });
    const r = db.prepare("INSERT INTO comments (user_id,post_id,content) VALUES (?,?,?)")
        .run(req.user.id, req.params.id, content);
    db.prepare("UPDATE posts SET comments_count=comments_count+1 WHERE id=?").run(req.params.id);
    const comment = db.prepare("SELECT c.*,u.nickname AS user_name,u.avatar_url AS user_avatar FROM comments c JOIN users u ON c.user_id=u.id WHERE c.id=?")
        .get(r.lastInsertRowid);
    createNotification(db, {
        userId: post.author_id,
        actorId: req.user.id,
        kind: "interaction",
        eventType: "post_commented",
        title: "有人评论了你的校园墙",
        content: content.trim().slice(0, 60),
        objectType: "post",
        objectId: Number(req.params.id)
    });
    res.json({ code: 200, message: "????", data: comment });
});

router.delete("/:postId/comment/:commentId", authMiddleware, (req, res) => {
    const db = getDb();
    if (!db.prepare("SELECT id FROM comments WHERE id=? AND user_id=?").get(req.params.commentId, req.user.id))
        return res.json({ code: 403, message: "????" });
    db.prepare("DELETE FROM comments WHERE id=?").run(req.params.commentId);
    db.prepare("UPDATE posts SET comments_count=comments_count-1 WHERE id=?").run(req.params.postId);
    res.json({ code: 200, message: "????" });
});

router.delete("/:id", authMiddleware, (req, res) => {
    const db = getDb();
    if (!db.prepare("SELECT id FROM posts WHERE id=? AND author_id=?").get(req.params.id, req.user.id))
        return res.json({ code: 403, message: "????" });
    db.prepare("DELETE FROM likes WHERE post_id=?").run(req.params.id);
    db.prepare("DELETE FROM comments WHERE post_id=?").run(req.params.id);
    db.prepare("DELETE FROM posts WHERE id=?").run(req.params.id);
    res.json({ code: 200, message: "????" });
});

module.exports = router;
