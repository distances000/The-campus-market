const express = require("express");
const { getDb } = require("../config/db");
const { authMiddleware, optionalAuth } = require("../middleware/auth");
const { createNotification } = require("../utils/notifications");
const { normalizeImageList, deleteManagedUploadsIfOrphan } = require("../utils/upload");
const { getUserFacingMessage, isDuplicateEntryError } = require("../utils/error");
const {
    ensureOptionalText,
    ensurePagination,
    ensurePositiveInt,
    ensureRequiredText
} = require("../utils/validate");
const router = express.Router();

const MAX_POST_CONTENT_LENGTH = 2000;
const MAX_COMMENT_CONTENT_LENGTH = 300;
const MAX_CAMPUS_LENGTH = 50;

router.post("/", authMiddleware, async (req, res) => {
    const { content, images_json, campus } = req.body;
    let normalizedContent;
    let normalizedCampus;

    try {
        normalizedContent = ensureRequiredText(content, "帖子内容", { maxLength: MAX_POST_CONTENT_LENGTH });
        normalizedCampus = ensureOptionalText(campus, "校区", { maxLength: MAX_CAMPUS_LENGTH });
    } catch (error) {
        return res.json({ code: 400, message: getUserFacingMessage(error, "帖子内容填写不完整") });
    }

    let images = [];
    try {
        images = normalizeImageList(images_json || "[]");
    } catch (error) {
        return res.json({ code: 400, message: getUserFacingMessage(error, "帖子图片格式不正确") });
    }
    const db = getDb();
    const duplicatedPost = await db.prepare(`
        SELECT id
        FROM posts
        WHERE author_id=? AND content=? AND created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 10 SECOND)
        LIMIT 1
    `).get(req.user.id, normalizedContent);
    if (duplicatedPost) {
        return res.json({ code: 400, message: "请勿重复提交相同帖子" });
    }
    const r = await db.prepare("INSERT INTO posts (author_id,content,images_json,campus) VALUES (?,?,?,?)")
        .run(req.user.id, normalizedContent, JSON.stringify(images), normalizedCampus);
    const post = await db.prepare("SELECT p.*,u.nickname AS author_name,u.avatar_url AS author_avatar FROM posts p JOIN users u ON p.author_id=u.id WHERE p.id=?")
        .get(r.lastInsertRowid);
    post.images = JSON.parse(post.images_json); delete post.images_json;
    res.json({ code: 200, message: "帖子发布成功", data: post });
});

router.get("/", optionalAuth, async (req, res) => {
    const { campus, page = 1, page_size = 20 } = req.query;
    const db = getDb();
    let pagination;

    try {
        pagination = ensurePagination({ page, page_size }, { defaultPageSize: 20, maxPageSize: 50 });
    } catch (error) {
        return res.json({ code: 400, message: getUserFacingMessage(error, "帖子列表查询参数不合法") });
    }

    const conds = [];
    const params = [];
    if (campus && campus !== "all") { conds.push("p.campus=?"); params.push(campus); }
    const where = conds.length ? "WHERE " + conds.join(" AND ") : "";
    const { page: pg, pageSize: ps, offset } = pagination;
    const total = (await db.prepare("SELECT COUNT(*) AS count FROM posts p " + where).get(...params)).count;
    const rows = await db.prepare("SELECT p.*,u.nickname AS author_name,u.avatar_url AS author_avatar FROM posts p JOIN users u ON p.author_id=u.id " + where + " ORDER BY p.created_at DESC LIMIT ? OFFSET ?")
        .all(...params, ps, offset);
    const list = [];
    for (const post of rows) {
        post.images = JSON.parse(post.images_json);
        delete post.images_json;
        post.is_liked = req.user ? !!(await db.prepare("SELECT id FROM likes WHERE user_id=? AND post_id=?").get(req.user.id, post.id)) : false;
        list.push(post);
    }
    res.json({ code: 200, data: { list, total, page: pg, page_size: ps } });
});

router.get("/:id", optionalAuth, async (req, res) => {
    const db = getDb();
    let postId;

    try {
        postId = ensurePositiveInt(req.params.id, "帖子ID");
    } catch (error) {
        return res.json({ code: 400, message: getUserFacingMessage(error, "帖子ID不合法") });
    }

    const post = await db.prepare("SELECT p.*,u.nickname AS author_name,u.avatar_url AS author_avatar FROM posts p JOIN users u ON p.author_id=u.id WHERE p.id=?")
        .get(postId);
    if (!post) return res.json({ code: 404, message: "帖子不存在或已删除" });
    post.images = JSON.parse(post.images_json); delete post.images_json;
    post.comments = await db.prepare("SELECT c.*,u.nickname AS user_name,u.avatar_url AS user_avatar FROM comments c JOIN users u ON c.user_id=u.id WHERE c.post_id=? ORDER BY c.created_at ASC")
        .all(post.id);
    post.is_liked = req.user ? !!(await db.prepare("SELECT id FROM likes WHERE user_id=? AND post_id=?").get(req.user.id, post.id)) : false;
    res.json({ code: 200, data: post });
});

router.post("/:id/like", authMiddleware, async (req, res) => {
    const db = getDb();
    let postId;

    try {
        postId = ensurePositiveInt(req.params.id, "帖子ID");
    } catch (error) {
        return res.json({ code: 400, message: getUserFacingMessage(error, "帖子ID不合法") });
    }

    const post = await db.prepare("SELECT id, author_id, content FROM posts WHERE id=?").get(postId);
    if (!post)
        return res.json({ code: 404, message: "帖子不存在或已删除" });
    const like = await db.prepare("SELECT id FROM likes WHERE user_id=? AND post_id=?").get(req.user.id, postId);
    if (like) {
        await db.prepare("DELETE FROM likes WHERE user_id=? AND post_id=?").run(req.user.id, postId);
        await db.prepare("UPDATE posts SET likes_count=likes_count-1 WHERE id=?").run(postId);
        res.json({ code: 200, message: "已取消点赞", data: { liked: false } });
    } else {
        try {
            await db.prepare("INSERT INTO likes (user_id,post_id) VALUES (?,?)").run(req.user.id, postId);
        } catch (error) {
            if (isDuplicateEntryError(error)) {
                return res.json({ code: 400, message: "请勿重复点赞" });
            }
            throw error;
        }
        await db.prepare("UPDATE posts SET likes_count=likes_count+1 WHERE id=?").run(postId);
        await createNotification(db, {
            userId: post.author_id,
            actorId: req.user.id,
            kind: "interaction",
            eventType: "post_liked",
            title: "有人赞了你的校园墙",
            content: post.content ? post.content.slice(0, 36) : "点击查看帖子详情",
            objectType: "post",
            objectId: postId
        });
        res.json({ code: 200, message: "点赞成功", data: { liked: true } });
    }
});

router.post("/:id/comment", authMiddleware, async (req, res) => {
    let postId;
    let normalizedContent;

    try {
        postId = ensurePositiveInt(req.params.id, "帖子ID");
        normalizedContent = ensureRequiredText(req.body.content, "评论内容", { maxLength: MAX_COMMENT_CONTENT_LENGTH });
    } catch (error) {
        return res.json({ code: 400, message: getUserFacingMessage(error, "评论内容不合法") });
    }

    const db = getDb();
    const post = await db.prepare("SELECT id, author_id, content FROM posts WHERE id=?").get(postId);
    if (!post)
        return res.json({ code: 404, message: "帖子不存在或已删除" });
    const duplicateComment = await db.prepare(`
        SELECT id
        FROM comments
        WHERE user_id=? AND post_id=? AND content=? AND created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 10 SECOND)
        LIMIT 1
    `).get(req.user.id, postId, normalizedContent);
    if (duplicateComment) {
        return res.json({ code: 400, message: "请勿重复提交相同评论" });
    }
    const r = await db.prepare("INSERT INTO comments (user_id,post_id,content) VALUES (?,?,?)")
        .run(req.user.id, postId, normalizedContent);
    await db.prepare("UPDATE posts SET comments_count=comments_count+1 WHERE id=?").run(postId);
    const comment = await db.prepare("SELECT c.*,u.nickname AS user_name,u.avatar_url AS user_avatar FROM comments c JOIN users u ON c.user_id=u.id WHERE c.id=?")
        .get(r.lastInsertRowid);
    await createNotification(db, {
        userId: post.author_id,
        actorId: req.user.id,
        kind: "interaction",
        eventType: "post_commented",
        title: "有人评论了你的校园墙",
        content: normalizedContent.slice(0, 60),
        objectType: "post",
        objectId: postId
    });
    res.json({ code: 200, message: "评论成功", data: comment });
});

router.delete("/:postId/comment/:commentId", authMiddleware, async (req, res) => {
    const db = getDb();
    let postId;
    let commentId;

    try {
        postId = ensurePositiveInt(req.params.postId, "帖子ID");
        commentId = ensurePositiveInt(req.params.commentId, "评论ID");
    } catch (error) {
        return res.json({ code: 400, message: getUserFacingMessage(error, "评论操作参数不合法") });
    }

    if (!await db.prepare("SELECT id FROM comments WHERE id=? AND post_id=? AND user_id=?").get(commentId, postId, req.user.id))
        return res.json({ code: 403, message: "无权删除该评论" });
    await db.prepare("DELETE FROM comments WHERE id=?").run(commentId);
    await db.prepare("UPDATE posts SET comments_count=GREATEST(comments_count-1, 0) WHERE id=?").run(postId);
    res.json({ code: 200, message: "评论已删除" });
});

router.delete("/:id", authMiddleware, async (req, res) => {
    const db = getDb();
    let postId;

    try {
        postId = ensurePositiveInt(req.params.id, "帖子ID");
    } catch (error) {
        return res.json({ code: 400, message: getUserFacingMessage(error, "帖子ID不合法") });
    }

    const post = await db.prepare("SELECT id, images_json FROM posts WHERE id=? AND author_id=?").get(postId, req.user.id);
    if (!post)
        return res.json({ code: 403, message: "无权删除该帖子" });
    await db.prepare("DELETE FROM likes WHERE post_id=?").run(postId);
    await db.prepare("DELETE FROM comments WHERE post_id=?").run(postId);
    await db.prepare("DELETE FROM posts WHERE id=?").run(postId);
    try {
        await deleteManagedUploadsIfOrphan(db, normalizeImageList(post.images_json || "[]"));
    } catch (error) {
        console.error("Failed to cleanup deleted post images:", error);
    }
    res.json({ code: 200, message: "帖子已删除" });
});

module.exports = router;
