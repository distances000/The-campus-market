const express = require("express");
const { getDb } = require("../config/db");
const { authMiddleware } = require("../middleware/auth");
const { getUserFacingMessage } = require("../utils/error");
const {
    ensureOptionalText,
    ensurePositiveInt
} = require("../utils/validate");

const router = express.Router();

const ALLOWED_TARGET_TYPES = ["product", "post"];
const ALLOWED_REASONS = ["spam", "fraud", "illegal", "abuse", "misleading", "other"];

async function getTargetSnapshot(db, targetType, targetId) {
    if (targetType === "product") {
        const product = await db.prepare(`
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
        const post = await db.prepare(`
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

router.post("/", authMiddleware, async (req, res) => {
    const { target_type, reason } = req.body;
    const normalizedType = typeof target_type === "string" ? target_type.trim() : "";
    const normalizedReason = typeof reason === "string" ? reason.trim() : "";
    let normalizedDescription = "";
    let targetId;

    if (!ALLOWED_TARGET_TYPES.includes(normalizedType)) {
        return res.json({ code: 400, message: "举报对象类型不合法" });
    }
    if (!ALLOWED_REASONS.includes(normalizedReason)) {
        return res.json({ code: 400, message: "举报原因不合法" });
    }

    try {
        targetId = ensurePositiveInt(req.body.target_id, "举报对象ID");
        normalizedDescription = ensureOptionalText(req.body.description, "补充说明", { maxLength: 500 });
    } catch (error) {
        return res.json({ code: 400, message: getUserFacingMessage(error, "举报参数不合法") });
    }

    const db = getDb();
    const snapshot = await getTargetSnapshot(db, normalizedType, targetId);
    if (!snapshot) {
        return res.json({ code: 404, message: "举报对象不存在或已删除" });
    }
    if (snapshot.target_owner_id === req.user.id) {
        return res.json({ code: 400, message: "不能举报自己发布的内容" });
    }

    const existed = await db.prepare(`
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

    const result = await db.prepare(`
        INSERT INTO reports (
            reporter_id,
            target_type,
            target_id,
            target_owner_id,
            snapshot_title,
            snapshot_excerpt,
            reason,
            description,
            resolution_note
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        req.user.id,
        normalizedType,
        targetId,
        snapshot.target_owner_id || null,
        snapshot.snapshot_title,
        snapshot.snapshot_excerpt,
        normalizedReason,
        normalizedDescription,
        ""
    );

    const report = await db.prepare(`
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

router.get("/my/list", authMiddleware, async (req, res) => {
    const db = getDb();
    const limit = 50;
    const list = await db.prepare(`
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
        LIMIT ?
    `).all(req.user.id, limit);

    return res.json({ code: 200, data: { list } });
});

module.exports = router;
