const express = require("express");
const { getDb } = require("../config/db");
const { authMiddleware } = require("../middleware/auth");
const { createNotification } = require("../utils/notifications");
const {
    emitConversationRead,
    emitMessageCreated,
    getUnreadSummary,
    pushConversationRefresh,
    pushUnreadSummary
} = require("../utils/realtime");
const { getUserFacingMessage } = require("../utils/error");
const {
    ensureOptionalEnum,
    ensureOptionalText,
    ensurePagination,
    ensurePositiveInt,
    ensureRequiredText
} = require("../utils/validate");

const router = express.Router();

const ALLOWED_NOTIFICATION_KINDS = ["interaction", "system"];
const MAX_MESSAGE_CONTENT_LENGTH = 500;
const MAX_SEARCH_KEYWORD_LENGTH = 30;

function safeJsonParse(value, fallback) {
    try {
        return value ? JSON.parse(value) : fallback;
    } catch {
        return fallback;
    }
}

async function getUserCredit(db, userId) {
    const result = await db.prepare(`
        SELECT
            COUNT(*) AS review_count,
            ROUND(COALESCE(AVG(rating), 0), 1) AS rating_avg
        FROM reviews
        WHERE reviewee_id=?
    `).get(userId);

    return {
        review_count: result.review_count || 0,
        rating_avg: Number(result.rating_avg || 0)
    };
}

async function buildUserSummary(db, currentUserId, targetUserId) {
    return await db.prepare(`
        SELECT
            u.id,
            u.username,
            u.nickname,
            u.avatar_url,
            u.campus,
            u.bio,
            EXISTS(
                SELECT 1
                FROM friends f
                WHERE f.user_id=? AND f.friend_id=u.id
            ) AS is_friend
        FROM users u
        WHERE u.id=?
    `).get(currentUserId, targetUserId);
}

async function buildUserDetail(db, currentUserId, targetUserId) {
    const user = await db.prepare(`
        SELECT
            u.id,
            u.username,
            u.nickname,
            u.avatar_url,
            u.campus,
            u.bio,
            u.created_at,
            EXISTS(
                SELECT 1
                FROM friends f
                WHERE f.user_id=? AND f.friend_id=u.id
            ) AS is_friend,
            (
                SELECT COUNT(*)
                FROM friends f
                WHERE f.user_id=u.id
            ) AS friend_count,
            (
                SELECT COUNT(*)
                FROM products p
                WHERE p.seller_id=u.id
            ) AS product_count,
            (
                SELECT COUNT(*)
                FROM products p
                WHERE p.seller_id=u.id AND p.status='active'
            ) AS active_product_count
        FROM users u
        WHERE u.id=?
    `).get(currentUserId, targetUserId);

    if (!user) {
        return null;
    }

    return {
        ...user,
        credit: await getUserCredit(db, targetUserId)
    };
}

async function markConversationAsRead(db, currentUserId, peerUserId) {
    const unread = await db.prepare(`
        SELECT MAX(id) AS last_read_message_id
        FROM messages
        WHERE receiver_id=? AND sender_id=? AND is_read=0
    `).get(currentUserId, peerUserId);

    const result = await db.prepare(`
        UPDATE messages
        SET is_read=1
        WHERE receiver_id=? AND sender_id=? AND is_read=0
    `).run(currentUserId, peerUserId);

    if (result.changes > 0 && unread.last_read_message_id) {
        await emitConversationRead(db, {
            readerId: currentUserId,
            peerId: peerUserId,
            lastReadMessageId: unread.last_read_message_id
        });
    } else if (result.changes > 0) {
        await pushUnreadSummary(db, currentUserId);
        await pushConversationRefresh(db, currentUserId, { peer_id: Number(peerUserId) });
    }

    return {
        changes: result.changes,
        last_read_message_id: unread.last_read_message_id || null
    };
}

async function shouldShowConversation(db, userId, peerId, lastTime) {
    const hidden = await db.prepare(`
        SELECT hidden_at
        FROM hidden_conversations
        WHERE user_id=? AND peer_id=?
    `).get(userId, peerId);

    if (!hidden?.hidden_at) {
        return true;
    }

    return new Date(lastTime).getTime() > new Date(hidden.hidden_at).getTime();
}

router.post("/", authMiddleware, async (req, res) => {
    let receiverId;
    let normalizedContent;

    try {
        receiverId = ensurePositiveInt(req.body.receiver_id, "接收方ID");
        normalizedContent = ensureRequiredText(req.body.content, "消息内容", { maxLength: MAX_MESSAGE_CONTENT_LENGTH });
    } catch (error) {
        return res.json({ code: 400, message: getUserFacingMessage(error, "消息内容不合法") });
    }

    if (receiverId === req.user.id) {
        return res.json({ code: 400, message: "不能给自己发消息" });
    }

    const db = getDb();
    if (!await db.prepare("SELECT id FROM users WHERE id=?").get(receiverId)) {
        return res.json({ code: 404, message: "用户不存在" });
    }
    const duplicatedMessage = await db.prepare(`
        SELECT id
        FROM messages
        WHERE sender_id=? AND receiver_id=? AND content=? AND created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 5 SECOND)
        LIMIT 1
    `).get(req.user.id, receiverId, normalizedContent);
    if (duplicatedMessage) {
        return res.json({ code: 400, message: "请勿重复发送相同消息" });
    }

    const result = await db.prepare(`
        INSERT INTO messages (sender_id, receiver_id, content)
        VALUES (?, ?, ?)
    `).run(req.user.id, receiverId, normalizedContent);

    const message = await emitMessageCreated(db, result.lastInsertRowid);
    return res.json({ code: 200, message: "发送成功", data: message });
});

router.get("/conversation/:userId", authMiddleware, async (req, res) => {
    const db = getDb();
    let peerUserId;
    let pagination;

    try {
        peerUserId = ensurePositiveInt(req.params.userId, "用户ID");
        pagination = ensurePagination(req.query, { defaultPageSize: 50, maxPageSize: 100 });
    } catch (error) {
        return res.json({ code: 400, message: getUserFacingMessage(error, "会话查询参数不合法") });
    }

    const { page, pageSize, offset } = pagination;

    const list = await db.prepare(`
        SELECT
            m.*,
            sender.nickname AS sender_name,
            sender.avatar_url AS sender_avatar,
            receiver.nickname AS receiver_name,
            receiver.avatar_url AS receiver_avatar
        FROM messages m
        JOIN users sender ON sender.id=m.sender_id
        JOIN users receiver ON receiver.id=m.receiver_id
        WHERE (m.sender_id=? AND m.receiver_id=?)
           OR (m.sender_id=? AND m.receiver_id=?)
        ORDER BY m.created_at DESC
        LIMIT ? OFFSET ?
    `).all(req.user.id, peerUserId, peerUserId, req.user.id, pageSize, offset);

    await markConversationAsRead(db, req.user.id, peerUserId);
    return res.json({ code: 200, data: { list: list.reverse() } });
});

router.post("/conversation/:userId/read", authMiddleware, async (req, res) => {
    const db = getDb();
    let peerUserId;

    try {
        peerUserId = ensurePositiveInt(req.params.userId, "用户ID");
    } catch (error) {
        return res.json({ code: 400, message: getUserFacingMessage(error, "用户ID不合法") });
    }

    const result = await markConversationAsRead(db, req.user.id, peerUserId);
    return res.json({
        code: 200,
        message: "已更新已读状态",
        data: {
            ...await getUnreadSummary(db, req.user.id),
            last_read_message_id: result.last_read_message_id
        }
    });
});

router.get("/conversations", authMiddleware, async (req, res) => {
    const db = getDb();
    const data = await db.prepare(`
        SELECT
            conv.other_id,
            u.nickname AS other_name,
            u.avatar_url AS other_avatar,
            conv.last_time,
            (
                SELECT content
                FROM messages m2
                WHERE (m2.sender_id=? AND m2.receiver_id=conv.other_id)
                   OR (m2.sender_id=conv.other_id AND m2.receiver_id=?)
                ORDER BY m2.created_at DESC, m2.id DESC
                LIMIT 1
            ) AS last_message,
            (
                SELECT COUNT(*)
                FROM messages m3
                WHERE m3.receiver_id=?
                  AND m3.sender_id=conv.other_id
                  AND m3.is_read=0
            ) AS unread_count
        FROM (
            SELECT
                CASE WHEN sender_id=? THEN receiver_id ELSE sender_id END AS other_id,
                MAX(created_at) AS last_time
            FROM messages
            WHERE sender_id=? OR receiver_id=?
            GROUP BY CASE WHEN sender_id=? THEN receiver_id ELSE sender_id END
        ) AS conv
        JOIN users u ON u.id=conv.other_id
        ORDER BY conv.last_time DESC
    `).all(req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id);

    const visible = [];
    for (const item of data) {
        if (await shouldShowConversation(db, req.user.id, item.other_id, item.last_time)) {
            visible.push(item);
        }
    }

    return res.json({ code: 200, data: visible });
});

router.delete("/conversations/:userId", authMiddleware, async (req, res) => {
    const db = getDb();
    let peerUserId;

    try {
        peerUserId = ensurePositiveInt(req.params.userId, "用户ID");
    } catch (error) {
        return res.json({ code: 400, message: getUserFacingMessage(error, "用户ID不合法") });
    }

    if (peerUserId === req.user.id) {
        return res.json({ code: 400, message: "不能删除与自己的会话" });
    }

    const hasConversation = await db.prepare(`
        SELECT id
        FROM messages
        WHERE (sender_id=? AND receiver_id=?)
           OR (sender_id=? AND receiver_id=?)
        LIMIT 1
    `).get(req.user.id, peerUserId, peerUserId, req.user.id);

    if (!hasConversation) {
        return res.json({ code: 404, message: "该会话不存在" });
    }

    const readResult = await markConversationAsRead(db, req.user.id, peerUserId);

    await db.prepare(`
        INSERT INTO hidden_conversations (user_id, peer_id, hidden_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE hidden_at=CURRENT_TIMESTAMP
    `).run(req.user.id, peerUserId);

    await pushConversationRefresh(db, req.user.id, { peer_id: peerUserId, type: "conversation_hidden" });
    await pushUnreadSummary(db, req.user.id);

    return res.json({
        code: 200,
        message: "已从最近会话中删除",
        data: { last_read_message_id: readResult.last_read_message_id }
    });
});

router.get("/friends", authMiddleware, async (req, res) => {
    const db = getDb();
    const data = await db.prepare(`
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
                WHERE (m.sender_id=? AND m.receiver_id=u.id)
                   OR (m.sender_id=u.id AND m.receiver_id=?)
                ORDER BY m.created_at DESC
                LIMIT 1
            ) AS last_message,
            (
                SELECT MAX(created_at)
                FROM messages m
                WHERE (m.sender_id=? AND m.receiver_id=u.id)
                   OR (m.sender_id=u.id AND m.receiver_id=?)
            ) AS last_time,
            (
                SELECT COUNT(*)
                FROM messages m
                WHERE m.receiver_id=? AND m.sender_id=u.id AND m.is_read=0
            ) AS unread_count
        FROM friends f
        JOIN users u ON u.id=f.friend_id
        WHERE f.user_id=?
        ORDER BY COALESCE(last_time, f.created_at) DESC, LOWER(u.nickname) ASC
    `).all(req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id);

    return res.json({ code: 200, data });
});

router.post("/friends/:friendId", authMiddleware, async (req, res) => {
    const db = getDb();
    let friendId;

    try {
        friendId = ensurePositiveInt(req.params.friendId, "好友ID");
    } catch (error) {
        return res.json({ code: 400, message: getUserFacingMessage(error, "好友ID不合法") });
    }

    if (friendId === req.user.id) {
        return res.json({ code: 400, message: "不能添加自己为好友" });
    }

    const target = await db.prepare("SELECT id FROM users WHERE id=?").get(friendId);
    if (!target) {
        return res.json({ code: 404, message: "用户不存在" });
    }

    const exists = await db.prepare("SELECT id FROM friends WHERE user_id=? AND friend_id=?").get(req.user.id, friendId);
    if (exists) {
        return res.json({ code: 200, message: "已经是好友了" });
    }

    await db.transaction(async (tx) => {
        await tx.prepare("INSERT INTO friends (user_id, friend_id) VALUES (?, ?)").run(req.user.id, friendId);
        await tx.prepare("INSERT INTO friends (user_id, friend_id) VALUES (?, ?)").run(friendId, req.user.id);
    });

    await createNotification(db, {
        userId: friendId,
        actorId: req.user.id,
        kind: "interaction",
        eventType: "friend_added",
        title: "你有新的好友",
        content: "对方已将你添加为好友",
        objectType: "friend",
        objectId: req.user.id
    });

    await pushConversationRefresh(db, req.user.id, { peer_id: friendId, type: "friend_added" });
    await pushConversationRefresh(db, friendId, { peer_id: req.user.id, type: "friend_added" });

    return res.json({
        code: 200,
        message: "添加好友成功",
        data: await buildUserSummary(db, req.user.id, friendId)
    });
});

router.delete("/friends/:friendId", authMiddleware, async (req, res) => {
    const db = getDb();
    let friendId;

    try {
        friendId = ensurePositiveInt(req.params.friendId, "好友ID");
    } catch (error) {
        return res.json({ code: 400, message: getUserFacingMessage(error, "好友ID不合法") });
    }

    if (friendId === req.user.id) {
        return res.json({ code: 400, message: "不能删除自己" });
    }

    const exists = await db.prepare("SELECT id FROM friends WHERE user_id=? AND friend_id=?").get(req.user.id, friendId);
    if (!exists) {
        return res.json({ code: 404, message: "该用户当前不是你的好友" });
    }

    await db.transaction(async (tx) => {
        await tx.prepare("DELETE FROM friends WHERE user_id=? AND friend_id=?").run(req.user.id, friendId);
        await tx.prepare("DELETE FROM friends WHERE user_id=? AND friend_id=?").run(friendId, req.user.id);
    });

    await pushConversationRefresh(db, req.user.id, { peer_id: friendId, type: "friend_removed" });
    await pushConversationRefresh(db, friendId, { peer_id: req.user.id, type: "friend_removed" });
    await pushUnreadSummary(db, req.user.id);
    await pushUnreadSummary(db, friendId);

    return res.json({ code: 200, message: "已删除好友" });
});

router.get("/notifications", authMiddleware, async (req, res) => {
    const db = getDb();
    let kind;
    let pagination;

    try {
        kind = ensureOptionalEnum(req.query.kind, ALLOWED_NOTIFICATION_KINDS, "通知类型", { defaultValue: "interaction" });
        pagination = ensurePagination(req.query, { defaultPageSize: 20, maxPageSize: 50 });
    } catch (error) {
        return res.json({ code: 400, message: getUserFacingMessage(error, "通知查询参数不合法") });
    }

    const { page, pageSize, offset } = pagination;
    const total = (await db.prepare(`
        SELECT COUNT(*) AS count
        FROM notifications
        WHERE user_id=? AND kind=?
    `).get(req.user.id, kind)).count;
    const unread = (await db.prepare(`
        SELECT COUNT(*) AS count
        FROM notifications
        WHERE user_id=? AND kind=? AND is_read=0
    `).get(req.user.id, kind)).count;

    const list = (await db.prepare(`
        SELECT
            n.*,
            actor.nickname AS actor_name,
            actor.avatar_url AS actor_avatar
        FROM notifications n
        LEFT JOIN users actor ON actor.id=n.actor_id
        WHERE n.user_id=? AND n.kind=?
        ORDER BY n.is_read ASC, n.created_at DESC
        LIMIT ? OFFSET ?
    `).all(req.user.id, kind, pageSize, offset)).map((item) => {
        const next = { ...item, extra: safeJsonParse(item.extra_json, {}) };
        delete next.extra_json;
        return next;
    });

    return res.json({
        code: 200,
        data: {
            list,
            total,
            unread_count: unread || 0,
            page,
            page_size: pageSize
        }
    });
});

router.post("/notifications/read", authMiddleware, async (req, res) => {
    const db = getDb();
    const { id, kind } = req.body || {};
    let notificationId = null;
    let normalizedKind = "";

    try {
        if (id !== undefined && id !== null && String(id).trim() !== "") {
            notificationId = ensurePositiveInt(id, "通知ID");
        }
        if (kind !== undefined && kind !== null && String(kind).trim() !== "") {
            normalizedKind = ensureOptionalEnum(kind, ALLOWED_NOTIFICATION_KINDS, "通知类型", { defaultValue: "" });
        }
    } catch (error) {
        return res.json({ code: 400, message: getUserFacingMessage(error, "通知参数不合法") });
    }

    if (notificationId) {
        await db.prepare("UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?").run(notificationId, req.user.id);
    } else if (normalizedKind) {
        await db.prepare("UPDATE notifications SET is_read=1 WHERE user_id=? AND kind=?").run(req.user.id, normalizedKind);
    } else {
        await db.prepare("UPDATE notifications SET is_read=1 WHERE user_id=?").run(req.user.id);
    }

    await pushUnreadSummary(db, req.user.id);
    return res.json({ code: 200, message: "已更新通知状态", data: await getUnreadSummary(db, req.user.id) });
});

router.get("/users/search", authMiddleware, async (req, res) => {
    const db = getDb();
    let keyword = "";

    try {
        keyword = ensureOptionalText(req.query.keyword, "搜索关键词", { maxLength: MAX_SEARCH_KEYWORD_LENGTH });
    } catch (error) {
        return res.json({ code: 400, message: getUserFacingMessage(error, "搜索关键词不合法") });
    }

    if (!keyword) {
        return res.json({ code: 200, data: [] });
    }

    const like = `%${keyword}%`;
    const data = await db.prepare(`
        SELECT
            u.id,
            u.username,
            u.nickname,
            u.avatar_url,
            u.campus,
            u.bio,
            EXISTS(
                SELECT 1
                FROM friends f
                WHERE f.user_id=? AND f.friend_id=u.id
            ) AS is_friend
        FROM users u
        WHERE u.id != ?
          AND (u.username LIKE ? OR u.nickname LIKE ?)
        ORDER BY is_friend DESC, LOWER(u.nickname) ASC, LOWER(u.username) ASC
        LIMIT 20
    `).all(req.user.id, req.user.id, like, like);

    return res.json({ code: 200, data });
});

router.get("/users/:id", authMiddleware, async (req, res) => {
    const db = getDb();
    let targetUserId;

    try {
        targetUserId = ensurePositiveInt(req.params.id, "用户ID");
    } catch (error) {
        return res.json({ code: 400, message: getUserFacingMessage(error, "用户ID不合法") });
    }

    const user = await buildUserDetail(db, req.user.id, targetUserId);
    if (!user) {
        return res.json({ code: 404, message: "用户不存在" });
    }
    return res.json({ code: 200, data: user });
});

router.get("/unread", authMiddleware, async (req, res) => {
    const db = getDb();
    return res.json({ code: 200, data: await getUnreadSummary(db, req.user.id) });
});

module.exports = router;
