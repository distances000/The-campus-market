const { emitNotificationCreated } = require("./realtime");
const { logError } = require("./logger");

async function createNotification(db, {
    userId,
    actorId = null,
    kind = "system",
    eventType = "system_notice",
    title,
    content = "",
    objectType = "",
    objectId = null,
    extra = {}
}) {
    if (!db || !userId || !title) return null;
    if (kind === "interaction" && actorId && Number(actorId) === Number(userId)) return null;
    try {
        const result = await db.prepare(`
            INSERT INTO notifications (
                user_id,
                actor_id,
                kind,
                event_type,
                title,
                content,
                object_type,
                object_id,
                extra_json
            ) VALUES (?,?,?,?,?,?,?,?,?)
        `).run(
            userId,
            actorId,
            kind,
            eventType,
            title,
            content,
            objectType,
            objectId,
            JSON.stringify(extra || {})
        );

        try {
            await emitNotificationCreated(db, result.lastInsertRowid);
        } catch (error) {
            logError("notification.emit_failed", "通知实时推送失败", error, {
                notification_id: result.lastInsertRowid,
                user_id: userId
            });
        }

        return result.lastInsertRowid;
    } catch (error) {
        logError("notification.create_failed", "通知写入失败", error, {
            user_id: userId,
            kind,
            event_type: eventType
        });
        return null;
    }
}

module.exports = { createNotification };
