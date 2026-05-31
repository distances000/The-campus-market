const streams = new Map();

function normalizeUserId(userId) {
    return String(userId);
}

function safeJsonParse(value, fallback) {
    try {
        return value ? JSON.parse(value) : fallback;
    } catch {
        return fallback;
    }
}

function writeSse(res, event, payload) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function addUserStream(userId, client) {
    const key = normalizeUserId(userId);
    if (!streams.has(key)) {
        streams.set(key, new Set());
    }
    streams.get(key).add(client);
}

function removeUserStream(userId, client) {
    const key = normalizeUserId(userId);
    const bucket = streams.get(key);
    if (!bucket) {
        return;
    }
    bucket.delete(client);
    if (!bucket.size) {
        streams.delete(key);
    }
}

function pushToUser(userId, event, payload) {
    const bucket = streams.get(normalizeUserId(userId));
    if (!bucket?.size) {
        return;
    }

    for (const client of [...bucket]) {
        try {
            writeSse(client.res, event, payload);
        } catch {
            removeUserStream(userId, client);
        }
    }
}

function getUnreadSummary(db, userId) {
    const chat = db.prepare(`
        SELECT COUNT(*) AS count
        FROM messages
        WHERE receiver_id=? AND is_read=0
    `).get(userId);
    const interaction = db.prepare(`
        SELECT COUNT(*) AS count
        FROM notifications
        WHERE user_id=? AND kind='interaction' AND is_read=0
    `).get(userId);
    const system = db.prepare(`
        SELECT COUNT(*) AS count
        FROM notifications
        WHERE user_id=? AND kind='system' AND is_read=0
    `).get(userId);

    return {
        unread_count: (chat.count || 0) + (interaction.count || 0) + (system.count || 0),
        chat_unread_count: chat.count || 0,
        interaction_unread_count: interaction.count || 0,
        system_unread_count: system.count || 0
    };
}

function pushUnreadSummary(db, userId) {
    pushToUser(userId, "unread_summary", getUnreadSummary(db, userId));
}

function getMessagePayload(db, messageId) {
    const message = db.prepare(`
        SELECT
            m.*,
            sender.nickname AS sender_name,
            sender.avatar_url AS sender_avatar,
            receiver.nickname AS receiver_name,
            receiver.avatar_url AS receiver_avatar
        FROM messages m
        JOIN users sender ON sender.id=m.sender_id
        JOIN users receiver ON receiver.id=m.receiver_id
        WHERE m.id=?
    `).get(messageId);

    return message || null;
}

function pushConversationRefresh(userId, payload = {}) {
    pushToUser(userId, "conversation_refresh", payload);
}

function emitMessageCreated(db, messageId) {
    const message = getMessagePayload(db, messageId);
    if (!message) {
        return null;
    }

    pushToUser(message.sender_id, "message", message);
    pushToUser(message.receiver_id, "message", message);
    pushConversationRefresh(message.sender_id, { peer_id: message.receiver_id, message_id: message.id });
    pushConversationRefresh(message.receiver_id, { peer_id: message.sender_id, message_id: message.id });
    pushUnreadSummary(db, message.sender_id);
    pushUnreadSummary(db, message.receiver_id);
    return message;
}

function getNotificationPayload(db, notificationId) {
    const notification = db.prepare(`
        SELECT
            n.*,
            actor.nickname AS actor_name,
            actor.avatar_url AS actor_avatar
        FROM notifications n
        LEFT JOIN users actor ON actor.id=n.actor_id
        WHERE n.id=?
    `).get(notificationId);

    if (!notification) {
        return null;
    }

    notification.extra = safeJsonParse(notification.extra_json, {});
    delete notification.extra_json;
    return notification;
}

function emitNotificationCreated(db, notificationId) {
    const notification = getNotificationPayload(db, notificationId);
    if (!notification) {
        return null;
    }

    pushToUser(notification.user_id, "notification", notification);
    pushUnreadSummary(db, notification.user_id);
    return notification;
}

module.exports = {
    addUserStream,
    removeUserStream,
    pushToUser,
    getUnreadSummary,
    pushUnreadSummary,
    getMessagePayload,
    pushConversationRefresh,
    emitMessageCreated,
    getNotificationPayload,
    emitNotificationCreated
};
