const express = require("express");
const { getDb } = require("../config/db");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

const ALLOWED_TARGET_TYPES = ["product", "post"];
const ALLOWED_REASONS = ["spam", "fraud", "illegal", "abuse", "misleading", "other"];

function getTargetSnapshot(db, targetType, targetId) {
    if (targetType === "product") {
        const product = db.prepare(`
            SELECT id, seller_id AS owner_id, title, description, status
            FROM products
            WHERE id=?
        `).get(targetId);

        if (!product) {
            return null;
        }

        return {
            target_owner_id: product.owner_id,
            snapshot_title: product.title || "",
            snapshot_excerpt: (product.description || "").trim().slice(0, 120)
        };
    }

    if (targetType === "post") {
        const post = db.prepare(`
            SELECT id, author_id AS owner_id, content
            FROM posts
            WHERE id=?
        `).get(targetId);

        if (!post) {
            return null;
        }

        return {
            target_owner_id: post.owner_id,
            snapshot_title: "校园墙帖子",
            snapshot_excerpt: (post.content || "").trim().slice(0, 120)
        };
    }

    return null;
}

router.post("/", authMiddleware, (req, res) => {
    const { target_type, target_id, reason, description = "" } = req.body;
    const normalizedType = typeof target_type === "string" ? target_type.trim() : "";
    const normalizedReason = typeof reason === "string" ? reason.trim() : "";
    const normalizedDescription = typeof description === "string" ? description.trim() : "";
    const targetId = Number(target_id);

    if (!ALLOWED_TARGET_TYPES.includes(normalizedType)) {
        return res.json({ code: 400, message: "举报对象类型不合法" });
    }
    if (!Number.isInteger(targetId) || targetId <= 0) {
        return res.json({ code: 400, message: "举报对象不存在" });
    }
    if (!ALLOWED_REASONS.includes(normalizedReason)) {
        return res.json({ code: 400, message: "举报原因不合法" });
    }
    if (normalizedDescription.length > 500) {
        return res.json({ code: 400, message: "补充说明不能超过 500 字" });
    }

    const db = getDb();
    const snapshot = getTargetSnapshot(db, normalizedType, targetId);
    if (!snapshot) {
        return res.json({ code: 404, message: "举报对象不存在或已删除" });
    }
    if (snapshot.target_owner_id === req.user.id) {
        return res.json({ code: 400, message: "不能举报自己发布的内容" });
    }

    const existed = db.prepare(`
        SELECT id
        FROM reports
        WHERE reporter_id=?
          AND target_type=?
          AND target_id=?
          AND status IN ('pending', 'reviewing')
    `).get(req.user.id, normalizedType, targetId);

    if (existed) {
        return res.json({ code: 400, message: "你已经举报过该内容，等待管理员处理即可" });
    }

    const result = db.prepare(`
        INSERT INTO reports (
            reporter_id,
            target_type,
            target_id,
            target_owner_id,
            snapshot_title,
            snapshot_excerpt,
            reason,
            description
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        req.user.id,
        normalizedType,
        targetId,
        snapshot.target_owner_id || null,
        snapshot.snapshot_title,
        snapshot.snapshot_excerpt,
        normalizedReason,
        normalizedDescription
    );

    const report = db.prepare(`
        SELECT
            r.*,
            u.nickname AS reporter_name
        FROM reports r
        JOIN users u ON u.id=r.reporter_id
        WHERE r.id=?
    `).get(result.lastInsertRowid);

    return res.json({
        code: 200,
        message: "举报已提交，管理员会尽快处理",
        data: report
    });
});

router.get("/my/list", authMiddleware, (req, res) => {
    const db = getDb();
    const list = db.prepare(`
        SELECT
            id,
            target_type,
            target_id,
            snapshot_title,
            snapshot_excerpt,
            reason,
            description,
            status,
            handled_action,
            resolution_note,
            handled_at,
            created_at
        FROM reports
        WHERE reporter_id=?
        ORDER BY created_at DESC
        LIMIT 50
    `).all(req.user.id);

    return res.json({ code: 200, data: { list } });
});

module.exports = router;
