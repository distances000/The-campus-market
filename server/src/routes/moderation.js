const express = require("express");
const bcrypt = require("bcryptjs");
const { getDb } = require("../config/db");
const { authMiddleware } = require("../middleware/auth");
const { moderationMiddleware } = require("../middleware/moderation");
const { createNotification } = require("../utils/notifications");
const { normalizeImageList, deleteManagedUploadsIfOrphan } = require("../utils/upload");

const router = express.Router();

const ALLOWED_REPORT_STATUSES = ["pending", "reviewing", "resolved", "rejected"];
const ALLOWED_REPORT_ACTIONS = ["none", "hide_product", "delete_post"];
const ALLOWED_RESET_STATUSES = ["pending", "reviewing", "resolved", "rejected"];

function normalizeText(value) {
    return String(value || "").trim();
}

function normalizePagination(query) {
    const page = Math.max(parseInt(query.page || 1, 10), 1);
    const pageSize = Math.min(Math.max(parseInt(query.page_size || 20, 10), 1), 100);
    return {
        page,
        pageSize,
        offset: (page - 1) * pageSize
    };
}

function getReportBaseSql(whereClause = "") {
    return `
        FROM reports r
        JOIN users reporter ON reporter.id=r.reporter_id
        LEFT JOIN users handler ON handler.id=r.handled_by
        LEFT JOIN users owner ON owner.id=r.target_owner_id
        ${whereClause}
    `;
}

function getPasswordResetBaseSql(whereClause = "") {
    return `
        FROM password_reset_requests pr
        JOIN users requester ON requester.id=pr.user_id
        LEFT JOIN users handler ON handler.id=pr.handled_by
        ${whereClause}
    `;
}

async function applyModerationAction(db, report, actionType) {
    if (actionType === "none") {
        return;
    }

    if (actionType === "hide_product") {
        if (report.target_type !== "product") {
            throw new Error("只有商品举报才能执行下架操作");
        }
        const product = await db.prepare("SELECT id FROM products WHERE id=?").get(report.target_id);
        if (!product) {
            throw new Error("该商品已不存在，无法重复下架");
        }
        await db.prepare("UPDATE products SET status='inactive', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(report.target_id);
        return;
    }

    if (actionType === "delete_post") {
        if (report.target_type !== "post") {
            throw new Error("只有帖子举报才能执行删除操作");
        }
        const post = await db.prepare("SELECT id, images_json FROM posts WHERE id=?").get(report.target_id);
        if (!post) {
            throw new Error("该帖子已不存在，无法重复删除");
        }
        await db.prepare("DELETE FROM likes WHERE post_id=?").run(report.target_id);
        await db.prepare("DELETE FROM comments WHERE post_id=?").run(report.target_id);
        await db.prepare("DELETE FROM posts WHERE id=?").run(report.target_id);
        try {
            await deleteManagedUploadsIfOrphan(db, normalizeImageList(post.images_json || "[]"));
        } catch (error) {
            console.error("Failed to cleanup moderated post images:", error);
        }
    }
}

router.use(authMiddleware, moderationMiddleware);

router.get("/reports", async (req, res) => {
    const db = getDb();
    const { status, target_type, keyword } = req.query;
    const { page, pageSize, offset } = normalizePagination(req.query);
    const conditions = [];
    const params = [];

    if (status) {
        conditions.push("r.status=?");
        params.push(status);
    }
    if (target_type) {
        conditions.push("r.target_type=?");
        params.push(target_type);
    }
    if (keyword) {
        conditions.push("(r.snapshot_title LIKE ? OR r.snapshot_excerpt LIKE ? OR reporter.nickname LIKE ? OR r.description LIKE ?)");
        params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const total = (await db.prepare(`SELECT COUNT(*) AS count ${getReportBaseSql(whereClause)}`).get(...params)).count;
    const list = await db.prepare(`
        SELECT
            r.*,
            reporter.nickname AS reporter_name,
            reporter.avatar_url AS reporter_avatar,
            owner.nickname AS target_owner_name,
            handler.nickname AS handled_by_name
        ${getReportBaseSql(whereClause)}
        ORDER BY
            CASE r.status
                WHEN 'pending' THEN 0
                WHEN 'reviewing' THEN 1
                ELSE 2
            END,
            r.created_at DESC
        LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

    return res.json({
        code: 200,
        data: {
            list,
            total,
            page,
            page_size: pageSize
        }
    });
});

router.get("/reports/:id", async (req, res) => {
    const db = getDb();
    const report = await db.prepare(`
        SELECT
            r.*,
            reporter.nickname AS reporter_name,
            reporter.avatar_url AS reporter_avatar,
            reporter.username AS reporter_username,
            owner.nickname AS target_owner_name,
            owner.username AS target_owner_username,
            handler.nickname AS handled_by_name
        ${getReportBaseSql("WHERE r.id=?")}
    `).get(req.params.id);

    if (!report) {
        return res.json({ code: 404, message: "举报记录不存在" });
    }

    return res.json({ code: 200, data: report });
});

router.patch("/reports/:id", async (req, res) => {
    const normalizedStatus = normalizeText(req.body.status);
    const normalizedAction = normalizeText(req.body.handled_action) || "none";
    const resolutionNote = normalizeText(req.body.resolution_note);

    if (!ALLOWED_REPORT_STATUSES.includes(normalizedStatus)) {
        return res.json({ code: 400, message: "处理状态不合法" });
    }
    if (!ALLOWED_REPORT_ACTIONS.includes(normalizedAction)) {
        return res.json({ code: 400, message: "处理动作不合法" });
    }
    if (resolutionNote.length > 500) {
        return res.json({ code: 400, message: "处理说明不能超过 500 字" });
    }
    if ((normalizedStatus === "resolved" || normalizedStatus === "rejected") && !resolutionNote) {
        return res.json({ code: 400, message: "处理完成时必须填写处理说明" });
    }
    if (normalizedStatus !== "resolved" && normalizedAction !== "none") {
        return res.json({ code: 400, message: "只有处理为已处理时才能执行管理动作" });
    }

    const db = getDb();
    const report = await db.prepare("SELECT * FROM reports WHERE id=?").get(req.params.id);
    if (!report) {
        return res.json({ code: 404, message: "举报记录不存在" });
    }

    try {
        await db.transaction(async (tx) => {
            await applyModerationAction(tx, report, normalizedAction);
            await tx.prepare(`
                UPDATE reports
                SET
                    status=?,
                    handled_action=?,
                    resolution_note=?,
                    handled_by=?,
                    handled_at=CURRENT_TIMESTAMP,
                    updated_at=CURRENT_TIMESTAMP
                WHERE id=?
            `).run(normalizedStatus, normalizedAction, resolutionNote, req.user.id, report.id);
        });
    } catch (error) {
        return res.json({ code: 400, message: error.message || "举报处理失败" });
    }

    if (normalizedStatus === "resolved" || normalizedStatus === "rejected") {
        await createNotification(db, {
            userId: report.reporter_id,
            actorId: req.user.id,
            kind: "system",
            eventType: "report_processed",
            title: normalizedStatus === "resolved" ? "你的举报已处理" : "你的举报已驳回",
            content: resolutionNote || "管理员已更新举报处理结果",
            objectType: report.target_type,
            objectId: report.target_id
        });
    }

    const updated = await db.prepare(`
        SELECT
            r.*,
            reporter.nickname AS reporter_name,
            owner.nickname AS target_owner_name,
            handler.nickname AS handled_by_name
        ${getReportBaseSql("WHERE r.id=?")}
    `).get(report.id);

    return res.json({
        code: 200,
        message: "举报处理结果已更新",
        data: updated
    });
});

router.get("/password-resets", async (req, res) => {
    const db = getDb();
    const { status, keyword } = req.query;
    const { page, pageSize, offset } = normalizePagination(req.query);
    const conditions = [];
    const params = [];

    if (status) {
        conditions.push("pr.status=?");
        params.push(status);
    }
    if (keyword) {
        conditions.push("(pr.username_snapshot LIKE ? OR pr.request_email LIKE ? OR requester.email LIKE ? OR requester.nickname LIKE ? OR pr.reason LIKE ?)");
        params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const total = (await db.prepare(`SELECT COUNT(*) AS count ${getPasswordResetBaseSql(whereClause)}`).get(...params)).count;
    const list = await db.prepare(`
        SELECT
            pr.*,
            requester.nickname AS requester_name,
            requester.email AS bound_email,
            handler.nickname AS handled_by_name
        ${getPasswordResetBaseSql(whereClause)}
        ORDER BY
            CASE pr.status
                WHEN 'pending' THEN 0
                WHEN 'reviewing' THEN 1
                ELSE 2
            END,
            pr.created_at DESC
        LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

    return res.json({
        code: 200,
        data: {
            list,
            total,
            page,
            page_size: pageSize
        }
    });
});

router.get("/password-resets/:id", async (req, res) => {
    const db = getDb();
    const requestInfo = await db.prepare(`
        SELECT
            pr.*,
            requester.nickname AS requester_name,
            requester.username AS requester_username,
            requester.email AS bound_email,
            requester.must_change_password,
            handler.nickname AS handled_by_name
        ${getPasswordResetBaseSql("WHERE pr.id=?")}
    `).get(req.params.id);

    if (!requestInfo) {
        return res.json({ code: 404, message: "重置申请不存在" });
    }

    return res.json({ code: 200, data: requestInfo });
});

router.patch("/password-resets/:id", async (req, res) => {
    const normalizedStatus = normalizeText(req.body.status);
    const resolutionNote = normalizeText(req.body.resolution_note);
    const newPassword = String(req.body.new_password || "");

    if (!ALLOWED_RESET_STATUSES.includes(normalizedStatus)) {
        return res.json({ code: 400, message: "处理状态不合法" });
    }
    if (resolutionNote.length > 500) {
        return res.json({ code: 400, message: "处理说明不能超过 500 字" });
    }
    if ((normalizedStatus === "resolved" || normalizedStatus === "rejected") && !resolutionNote) {
        return res.json({ code: 400, message: "处理完成时必须填写处理说明" });
    }
    if (normalizedStatus === "resolved" && newPassword.length < 6) {
        return res.json({ code: 400, message: "人工重置时必须设置至少 6 位的临时密码" });
    }

    const db = getDb();
    const requestInfo = await db.prepare("SELECT * FROM password_reset_requests WHERE id=?").get(req.params.id);
    if (!requestInfo) {
        return res.json({ code: 404, message: "重置申请不存在" });
    }

    try {
        await db.transaction(async (tx) => {
            if (normalizedStatus === "resolved") {
                const nextHash = bcrypt.hashSync(newPassword, 10);
                await tx.prepare(`
                    UPDATE users
                    SET password_hash=?, must_change_password=1, updated_at=CURRENT_TIMESTAMP
                    WHERE id=?
                `).run(nextHash, requestInfo.user_id);
            }

            await tx.prepare(`
                UPDATE password_reset_requests
                SET
                    status=?,
                    resolution_note=?,
                    handled_by=?,
                    handled_at=?,
                    updated_at=CURRENT_TIMESTAMP
                WHERE id=?
            `).run(
                normalizedStatus,
                resolutionNote,
                req.user.id,
                normalizedStatus === "pending" ? null : new Date(),
                requestInfo.id
            );
        });
    } catch (error) {
        return res.json({ code: 400, message: error.message || "密码重置处理失败" });
    }

    if (normalizedStatus === "resolved" || normalizedStatus === "rejected") {
        await createNotification(db, {
            userId: requestInfo.user_id,
            actorId: req.user.id,
            kind: "system",
            eventType: "password_reset_processed",
            title: normalizedStatus === "resolved" ? "你的找回密码申请已通过" : "你的找回密码申请未通过",
            content: resolutionNote || "管理员已更新找回密码申请状态",
            objectType: "password_reset_request",
            objectId: requestInfo.id
        });
    }

    const updated = await db.prepare(`
        SELECT
            pr.*,
            requester.nickname AS requester_name,
            requester.username AS requester_username,
            requester.email AS bound_email,
            requester.must_change_password,
            handler.nickname AS handled_by_name
        ${getPasswordResetBaseSql("WHERE pr.id=?")}
    `).get(requestInfo.id);

    return res.json({
        code: 200,
        message: "密码重置申请已更新",
        data: updated
    });
});

module.exports = router;
