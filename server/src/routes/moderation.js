const express = require("express");
const bcrypt = require("bcryptjs");
const { getDb } = require("../config/db");
const { authMiddleware } = require("../middleware/auth");
const { moderationMiddleware } = require("../middleware/moderation");
const { createNotification } = require("../utils/notifications");
const { normalizeImageList, deleteManagedUploadsIfOrphan } = require("../utils/upload");
const { createAppError, getUserFacingMessage } = require("../utils/error");
const { ensureOptionalEnum, ensurePagination, ensurePositiveInt } = require("../utils/validate");
const { buildRequestMeta, logError, logInfo, logWarn } = require("../utils/logger");

const router = express.Router();

const ALLOWED_REPORT_STATUSES = ["pending", "reviewing", "resolved", "rejected"];
const ALLOWED_REPORT_ACTIONS = ["none", "hide_product", "delete_post"];
const ALLOWED_RESET_STATUSES = ["pending", "reviewing", "resolved", "rejected"];

function normalizeText(value) {
    return String(value || "").trim();
}

function validateResolutionNote(resolutionNote, options = {}) {
    const { requireWhenCompleted = true } = options;

    if (resolutionNote.length > 500) {
        return "\u5904\u7406\u8bf4\u660e\u4e0d\u80fd\u8d85\u8fc7 500 \u5b57";
    }
    if (requireWhenCompleted && !resolutionNote) {
        return "\u5904\u7406\u5b8c\u6210\u65f6\u5fc5\u987b\u586b\u5199\u5904\u7406\u8bf4\u660e";
    }
    return "";
}

function validateReportPatchPayload(body) {
    const normalizedStatus = normalizeText(body.status);
    const normalizedAction = normalizeText(body.handled_action) || "none";
    const resolutionNote = normalizeText(body.resolution_note);

    if (!ALLOWED_REPORT_STATUSES.includes(normalizedStatus)) {
        return { errorMessage: "\u5904\u7406\u72b6\u6001\u4e0d\u5408\u6cd5" };
    }
    if (!ALLOWED_REPORT_ACTIONS.includes(normalizedAction)) {
        return { errorMessage: "\u5904\u7406\u52a8\u4f5c\u4e0d\u5408\u6cd5" };
    }

    const noteError = validateResolutionNote(resolutionNote, {
        requireWhenCompleted: normalizedStatus === "resolved" || normalizedStatus === "rejected"
    });
    if (noteError) {
        return { errorMessage: noteError };
    }
    if (normalizedStatus !== "resolved" && normalizedAction !== "none") {
        return { errorMessage: "\u53ea\u6709\u5904\u7406\u4e3a\u5df2\u5904\u7406\u65f6\u624d\u80fd\u6267\u884c\u7ba1\u7406\u52a8\u4f5c" };
    }

    return {
        normalizedStatus,
        normalizedAction,
        resolutionNote,
        errorMessage: ""
    };
}

function validatePasswordResetPatchPayload(body) {
    const normalizedStatus = normalizeText(body.status);
    const resolutionNote = normalizeText(body.resolution_note);
    const newPassword = String(body.new_password || "");

    if (!ALLOWED_RESET_STATUSES.includes(normalizedStatus)) {
        return { errorMessage: "\u5904\u7406\u72b6\u6001\u4e0d\u5408\u6cd5" };
    }

    const noteError = validateResolutionNote(resolutionNote, {
        requireWhenCompleted: normalizedStatus === "resolved" || normalizedStatus === "rejected"
    });
    if (noteError) {
        return { errorMessage: noteError };
    }
    if (normalizedStatus === "resolved" && newPassword.length < 6) {
        return { errorMessage: "\u4eba\u5de5\u91cd\u7f6e\u65f6\u5fc5\u987b\u8bbe\u7f6e\u81f3\u5c11 6 \u4f4d\u7684\u4e34\u65f6\u5bc6\u7801" };
    }

    return {
        normalizedStatus,
        resolutionNote,
        newPassword,
        errorMessage: ""
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
            throw createAppError("\u53ea\u6709\u5546\u54c1\u4e3e\u62a5\u624d\u80fd\u6267\u884c\u4e0b\u67b6\u64cd\u4f5c");
        }
        const product = await db.prepare("SELECT id FROM products WHERE id=?").get(report.target_id);
        if (!product) {
            throw createAppError("\u8be5\u5546\u54c1\u5df2\u4e0d\u5b58\u5728\uff0c\u65e0\u6cd5\u91cd\u590d\u4e0b\u67b6");
        }
        await db.prepare("UPDATE products SET status='inactive', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(report.target_id);
        return;
    }

    if (actionType === "delete_post") {
        if (report.target_type !== "post") {
            throw createAppError("\u53ea\u6709\u5e16\u5b50\u4e3e\u62a5\u624d\u80fd\u6267\u884c\u5220\u9664\u64cd\u4f5c");
        }
        const post = await db.prepare("SELECT id, images_json FROM posts WHERE id=?").get(report.target_id);
        if (!post) {
            throw createAppError("\u8be5\u5e16\u5b50\u5df2\u4e0d\u5b58\u5728\uff0c\u65e0\u6cd5\u91cd\u590d\u5220\u9664");
        }
        await db.prepare("DELETE FROM likes WHERE post_id=?").run(report.target_id);
        await db.prepare("DELETE FROM comments WHERE post_id=?").run(report.target_id);
        await db.prepare("DELETE FROM posts WHERE id=?").run(report.target_id);
        try {
            await deleteManagedUploadsIfOrphan(db, normalizeImageList(post.images_json || "[]"));
        } catch (error) {
            logError("moderation.cleanup_failed", "\u5220\u9664\u8fdd\u89c4\u5e16\u5b50\u540e\u6e05\u7406\u56fe\u7247\u5931\u8d25", error, {
                target_type: report.target_type,
                target_id: report.target_id
            });
        }
    }
}

router.use(authMiddleware, moderationMiddleware);

router.get("/reports", async (req, res) => {
    const db = getDb();
    const { status, target_type, keyword } = req.query;
    let page;
    let pageSize;
    let offset;
    const conditions = [];
    const params = [];

    try {
        ({ page, pageSize, offset } = ensurePagination(req.query, { defaultPageSize: 20, maxPageSize: 100 }));
        ensureOptionalEnum(status, ALLOWED_REPORT_STATUSES, "\u4e3e\u62a5\u72b6\u6001", { defaultValue: "" });
    } catch (error) {
        return res.json({ code: 400, message: getUserFacingMessage(error, "\u4e3e\u62a5\u67e5\u8be2\u53c2\u6570\u4e0d\u5408\u6cd5") });
    }

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
    let reportId;

    try {
        reportId = ensurePositiveInt(req.params.id, "\u4e3e\u62a5ID");
    } catch (error) {
        return res.json({ code: 400, message: getUserFacingMessage(error, "\u4e3e\u62a5ID\u4e0d\u5408\u6cd5") });
    }

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
    `).get(reportId);

    if (!report) {
        return res.json({ code: 404, message: "\u4e3e\u62a5\u8bb0\u5f55\u4e0d\u5b58\u5728" });
    }

    return res.json({ code: 200, data: report });
});

router.patch("/reports/:id", async (req, res) => {
    const {
        normalizedStatus,
        normalizedAction,
        resolutionNote,
        errorMessage
    } = validateReportPatchPayload(req.body);

    if (errorMessage) {
        return res.json({ code: 400, message: errorMessage });
    }

    const db = getDb();
    let reportId;

    try {
        reportId = ensurePositiveInt(req.params.id, "\u4e3e\u62a5ID");
    } catch (error) {
        return res.json({ code: 400, message: getUserFacingMessage(error, "\u4e3e\u62a5ID\u4e0d\u5408\u6cd5") });
    }

    const report = await db.prepare("SELECT * FROM reports WHERE id=?").get(reportId);
    if (!report) {
        return res.json({ code: 404, message: "\u4e3e\u62a5\u8bb0\u5f55\u4e0d\u5b58\u5728" });
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
        logWarn("moderation.report_update_failed", "\u4e3e\u62a5\u5904\u7406\u5931\u8d25", buildRequestMeta(req, {
            report_id: reportId,
            reason: getUserFacingMessage(error, "\u4e3e\u62a5\u5904\u7406\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5")
        }));
        return res.json({ code: 400, message: getUserFacingMessage(error, "\u4e3e\u62a5\u5904\u7406\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5") });
    }

    if (normalizedStatus === "resolved" || normalizedStatus === "rejected") {
        await createNotification(db, {
            userId: report.reporter_id,
            actorId: req.user.id,
            kind: "system",
            eventType: "report_processed",
            title: normalizedStatus === "resolved" ? "\u4f60\u7684\u4e3e\u62a5\u5df2\u5904\u7406" : "\u4f60\u7684\u4e3e\u62a5\u5df2\u9a73\u56de",
            content: resolutionNote || "\u7ba1\u7406\u5458\u5df2\u66f4\u65b0\u4e3e\u62a5\u5904\u7406\u7ed3\u679c",
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

    logInfo("moderation.report_updated", "\u4e3e\u62a5\u5904\u7406\u7ed3\u679c\u5df2\u66f4\u65b0", buildRequestMeta(req, {
        report_id: report.id,
        target_type: report.target_type,
        target_id: report.target_id,
        status: normalizedStatus,
        action: normalizedAction
    }));

    return res.json({
        code: 200,
        message: "\u4e3e\u62a5\u5904\u7406\u7ed3\u679c\u5df2\u66f4\u65b0",
        data: updated
    });
});

router.get("/password-resets", async (req, res) => {
    const db = getDb();
    const { status, keyword } = req.query;
    let page;
    let pageSize;
    let offset;
    const conditions = [];
    const params = [];

    try {
        ({ page, pageSize, offset } = ensurePagination(req.query, { defaultPageSize: 20, maxPageSize: 100 }));
        ensureOptionalEnum(status, ALLOWED_RESET_STATUSES, "\u5904\u7406\u72b6\u6001", { defaultValue: "" });
    } catch (error) {
        return res.json({ code: 400, message: getUserFacingMessage(error, "\u627e\u56de\u5bc6\u7801\u5de5\u5355\u67e5\u8be2\u53c2\u6570\u4e0d\u5408\u6cd5") });
    }

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
    let requestId;

    try {
        requestId = ensurePositiveInt(req.params.id, "\u5de5\u5355ID");
    } catch (error) {
        return res.json({ code: 400, message: getUserFacingMessage(error, "\u5de5\u5355ID\u4e0d\u5408\u6cd5") });
    }

    const requestInfo = await db.prepare(`
        SELECT
            pr.*,
            requester.nickname AS requester_name,
            requester.username AS requester_username,
            requester.email AS bound_email,
            requester.must_change_password,
            handler.nickname AS handled_by_name
        ${getPasswordResetBaseSql("WHERE pr.id=?")}
    `).get(requestId);

    if (!requestInfo) {
        return res.json({ code: 404, message: "\u91cd\u7f6e\u7533\u8bf7\u4e0d\u5b58\u5728" });
    }

    return res.json({ code: 200, data: requestInfo });
});

router.patch("/password-resets/:id", async (req, res) => {
    const {
        normalizedStatus,
        resolutionNote,
        newPassword,
        errorMessage
    } = validatePasswordResetPatchPayload(req.body);

    if (errorMessage) {
        return res.json({ code: 400, message: errorMessage });
    }

    const db = getDb();
    let requestId;

    try {
        requestId = ensurePositiveInt(req.params.id, "\u5de5\u5355ID");
    } catch (error) {
        return res.json({ code: 400, message: getUserFacingMessage(error, "\u5de5\u5355ID\u4e0d\u5408\u6cd5") });
    }

    const requestInfo = await db.prepare("SELECT * FROM password_reset_requests WHERE id=?").get(requestId);
    if (!requestInfo) {
        return res.json({ code: 404, message: "\u91cd\u7f6e\u7533\u8bf7\u4e0d\u5b58\u5728" });
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
        logWarn("moderation.password_reset_failed", "\u5bc6\u7801\u91cd\u7f6e\u5de5\u5355\u5904\u7406\u5931\u8d25", buildRequestMeta(req, {
            reset_request_id: requestId,
            reason: getUserFacingMessage(error, "\u5bc6\u7801\u91cd\u7f6e\u5904\u7406\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5")
        }));
        return res.json({ code: 400, message: getUserFacingMessage(error, "\u5bc6\u7801\u91cd\u7f6e\u5904\u7406\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5") });
    }

    if (normalizedStatus === "resolved" || normalizedStatus === "rejected") {
        await createNotification(db, {
            userId: requestInfo.user_id,
            actorId: req.user.id,
            kind: "system",
            eventType: "password_reset_processed",
            title: normalizedStatus === "resolved" ? "\u4f60\u7684\u627e\u56de\u5bc6\u7801\u7533\u8bf7\u5df2\u901a\u8fc7" : "\u4f60\u7684\u627e\u56de\u5bc6\u7801\u7533\u8bf7\u672a\u901a\u8fc7",
            content: resolutionNote || "\u7ba1\u7406\u5458\u5df2\u66f4\u65b0\u627e\u56de\u5bc6\u7801\u7533\u8bf7\u72b6\u6001",
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

    logInfo("moderation.password_reset_updated", "\u5bc6\u7801\u91cd\u7f6e\u5de5\u5355\u5df2\u5904\u7406", buildRequestMeta(req, {
        reset_request_id: requestInfo.id,
        status: normalizedStatus,
        target_user_id: requestInfo.user_id
    }));

    return res.json({
        code: 200,
        message: "\u5bc6\u7801\u91cd\u7f6e\u5de5\u5355\u5df2\u5904\u7406",
        data: updated
    });
});

module.exports = router;
