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

const router = express.Router();

function parsePositiveInt(value, fallback) {
    const parsed = parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

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
        pushConversationRefresh(currentUserId, { peer_id: Number(peerUserId) });
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
    const { receiver_id, content } = req.body;
    const receiverId = Number(receiver_id);
    const normalizedContent = typeof content === "string" ? content.trim() : "";

    if (!receiverId || !normalizedContent) {
        return res.json({ code: 400, message: "请填写完整的消息内容" });
    }
    if (receiverId === req.user.id) {
        return res.json({ code: 400, message: "不能给自己发消息" });
    }

    const db = getDb();
    if (!await db.prepare("SELECT id FROM users WHERE id=?").get(receiverId)) {
        return res.json({ code: 404, message: "用户不存在" });
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
    const peerUserId = Number(req.params.userId);
    const page = parsePositiveInt(req.query.page, 1);
    const pageSize = parsePositiveInt(req.query.page_size, 50);
    const offset = (page - 1) * pageSize;

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
    const peerUserId = Number(req.params.userId);
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
    const peerUserId = Number(req.params.userId);

    if (!peerUserId || peerUserId === req.user.id) {
        return res.json({ code: 400, message: "删除最近会话请求无效" });
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

    pushConversationRefresh(req.user.id, { peer_id: peerUserId, type: "conversation_hidden" });
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
    const friendId = Number(req.params.friendId);

    if (!friendId || friendId === req.user.id) {
        return res.json({ code: 400, message: "好友添加无效" });
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

    pushConversationRefresh(req.user.id, { peer_id: friendId, type: "friend_added" });
    pushConversationRefresh(friendId, { peer_id: req.user.id, type: "friend_added" });

    return res.json({
        code: 200,
        message: "添加好友成功",
        data: await buildUserSummary(db, req.user.id, friendId)
    });
});

router.delete("/friends/:friendId", authMiddleware, async (req, res) => {
    const db = getDb();
    const friendId = Number(req.params.friendId);

    if (!friendId || friendId === req.user.id) {
        return res.json({ code: 400, message: "删除好友请求无效" });
    }

    const exists = await db.prepare("SELECT id FROM friends WHERE user_id=? AND friend_id=?").get(req.user.id, friendId);
    if (!exists) {
        return res.json({ code: 404, message: "该用户当前不是你的好友" });
    }

    await db.transaction(async (tx) => {
        await tx.prepare("DELETE FROM friends WHERE user_id=? AND friend_id=?").run(req.user.id, friendId);
        await tx.prepare("DELETE FROM friends WHERE user_id=? AND friend_id=?").run(friendId, req.user.id);
    });

    pushConversationRefresh(req.user.id, { peer_id: friendId, type: "friend_removed" });
    pushConversationRefresh(friendId, { peer_id: req.user.id, type: "friend_removed" });
    await pushUnreadSummary(db, req.user.id);
    await pushUnreadSummary(db, friendId);

    return res.json({ code: 200, message: "已删除好友" });
});

router.get("/notifications", authMiddleware, async (req, res) => {
    const db = getDb();
    const kind = typeof req.query.kind === "string" ? req.query.kind : "interaction";
    if (!["interaction", "system"].includes(kind)) {
        return res.json({ code: 400, message: "通知类型无效" });
    }

    const page = parsePositiveInt(req.query.page, 1);
    const pageSize = parsePositiveInt(req.query.page_size, 20);
    const offset = (page - 1) * pageSize;
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

    if (id) {
        await db.prepare("UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?").run(id, req.user.id);
    } else if (kind) {
        await db.prepare("UPDATE notifications SET is_read=1 WHERE user_id=? AND kind=?").run(req.user.id, kind);
    } else {
        await db.prepare("UPDATE notifications SET is_read=1 WHERE user_id=?").run(req.user.id);
    }

    await pushUnreadSummary(db, req.user.id);
    return res.json({ code: 200, message: "已更新通知状态", data: await getUnreadSummary(db, req.user.id) });
});

router.get("/users/search", authMiddleware, async (req, res) => {
    const db = getDb();
    const keyword = typeof req.query.keyword === "string" ? req.query.keyword.trim() : "";
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
    const user = await buildUserDetail(db, req.user.id, Number(req.params.id));
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
