function createNotification(db, {
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
    const result = db.prepare(`
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
    return result.lastInsertRowid;
}

module.exports = { createNotification };
