const crypto = require("crypto");
const { URL } = require("url");
const { verifyToken } = require("../middleware/auth");
const { getDb } = require("../config/db");

const WS_PATH = "/ws";
const MAGIC_WEBSOCKET_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const REALTIME_INSTANCE_ID = `${process.pid}-${crypto.randomUUID()}`;
const REALTIME_EVENT_POLL_INTERVAL_MS = Number.parseInt(process.env.REALTIME_EVENT_POLL_INTERVAL_MS || "1000", 10);
const REALTIME_EVENT_BATCH_SIZE = Number.parseInt(process.env.REALTIME_EVENT_BATCH_SIZE || "200", 10);
const REALTIME_EVENT_RETENTION_HOURS = Number.parseInt(process.env.REALTIME_EVENT_RETENTION_HOURS || "24", 10);
const REALTIME_EVENT_CLEANUP_INTERVAL_MS = Number.parseInt(process.env.REALTIME_EVENT_CLEANUP_INTERVAL_MS || String(10 * 60 * 1000), 10);

const connections = new Map();
let pollerStarted = false;
let pollerTimer = null;
let lastEventId = 0;
let isPolling = false;
let lastCleanupAt = 0;

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

function createConnectionId() {
    return crypto.randomUUID();
}

function getBucket(userId) {
    const key = normalizeUserId(userId);
    if (!connections.has(key)) {
        connections.set(key, new Map());
    }
    return connections.get(key);
}

function removeConnection(userId, connectionId) {
    const bucket = connections.get(normalizeUserId(userId));
    if (!bucket) {
        return;
    }
    bucket.delete(connectionId);
    if (!bucket.size) {
        connections.delete(normalizeUserId(userId));
    }
}

function writeFrame(socket, { opcode = 0x1, data = "" } = {}) {
    const payloadBuffer = Buffer.isBuffer(data) ? data : Buffer.from(String(data));
    const payloadLength = payloadBuffer.length;
    let header;

    if (payloadLength < 126) {
        header = Buffer.alloc(2);
        header[1] = payloadLength;
    } else if (payloadLength < 65536) {
        header = Buffer.alloc(4);
        header[1] = 126;
        header.writeUInt16BE(payloadLength, 2);
    } else {
        header = Buffer.alloc(10);
        header[1] = 127;
        header.writeBigUInt64BE(BigInt(payloadLength), 2);
    }

    header[0] = 0x80 | opcode;
    socket.write(Buffer.concat([header, payloadBuffer]));
}

function sendEvent(userId, type, payload) {
    const bucket = connections.get(normalizeUserId(userId));
    if (!bucket?.size) {
        return;
    }

    const message = JSON.stringify({ type, payload });
    for (const [connectionId, connection] of [...bucket.entries()]) {
        try {
            writeFrame(connection.socket, { opcode: 0x1, data: message });
        } catch {
            removeConnection(userId, connectionId);
        }
    }
}

async function publishUserEvent(db, userId, type, payload) {
    if (!db || !userId || !type) {
        return null;
    }

    const normalizedUserId = Number(userId);
    const payloadJson = JSON.stringify(payload ?? {});
    const result = await db.prepare(`
        INSERT INTO realtime_events (
            target_user_id,
            event_type,
            payload_json,
            origin_instance_id
        ) VALUES (?, ?, ?, ?)
    `).run(normalizedUserId, type, payloadJson, REALTIME_INSTANCE_ID);

    sendEvent(normalizedUserId, type, payload);
    return result.lastInsertRowid || null;
}

async function fetchLatestRealtimeEventId(db) {
    const row = await db.prepare(`
        SELECT MAX(id) AS max_id
        FROM realtime_events
    `).get();
    return Number(row?.max_id || 0);
}

async function cleanupRealtimeEvents(db, now = Date.now()) {
    if (now - lastCleanupAt < REALTIME_EVENT_CLEANUP_INTERVAL_MS) {
        return;
    }

    lastCleanupAt = now;
    await db.prepare(`
        DELETE FROM realtime_events
        WHERE created_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? HOUR)
    `).run(Math.max(1, REALTIME_EVENT_RETENTION_HOURS));
}

async function pollRealtimeEvents() {
    if (isPolling) {
        return;
    }

    isPolling = true;
    try {
        const db = getDb();
        let keepPolling = true;

        while (keepPolling) {
            const rows = await db.prepare(`
                SELECT id, target_user_id, event_type, payload_json, origin_instance_id
                FROM realtime_events
                WHERE id > ?
                ORDER BY id ASC
                LIMIT ?
            `).all(lastEventId, REALTIME_EVENT_BATCH_SIZE);

            if (!rows.length) {
                keepPolling = false;
                break;
            }

            for (const row of rows) {
                lastEventId = Math.max(lastEventId, Number(row.id || 0));
                if (row.origin_instance_id === REALTIME_INSTANCE_ID) {
                    continue;
                }
                sendEvent(row.target_user_id, row.event_type, safeJsonParse(row.payload_json, {}));
            }

            keepPolling = rows.length === REALTIME_EVENT_BATCH_SIZE;
        }

        await cleanupRealtimeEvents(db);
    } catch (error) {
        console.error("Failed to poll realtime events:", error);
    } finally {
        isPolling = false;
    }
}

async function startRealtimeEventPolling() {
    if (pollerStarted) {
        return;
    }

    pollerStarted = true;
    const db = getDb();
    lastEventId = await fetchLatestRealtimeEventId(db);
    pollerTimer = setInterval(() => {
        pollRealtimeEvents().catch((error) => {
            console.error("Realtime poller tick failed:", error);
        });
    }, Math.max(250, REALTIME_EVENT_POLL_INTERVAL_MS));
    if (typeof pollerTimer.unref === "function") {
        pollerTimer.unref();
    }
}

function decodeFrames(buffer) {
    const frames = [];
    let offset = 0;

    while (offset + 2 <= buffer.length) {
        const byte1 = buffer[offset];
        const byte2 = buffer[offset + 1];
        const opcode = byte1 & 0x0f;
        const masked = (byte2 & 0x80) !== 0;
        let payloadLength = byte2 & 0x7f;
        let cursor = offset + 2;

        if (payloadLength === 126) {
            if (cursor + 2 > buffer.length) break;
            payloadLength = buffer.readUInt16BE(cursor);
            cursor += 2;
        } else if (payloadLength === 127) {
            if (cursor + 8 > buffer.length) break;
            payloadLength = Number(buffer.readBigUInt64BE(cursor));
            cursor += 8;
        }

        const maskLength = masked ? 4 : 0;
        if (cursor + maskLength + payloadLength > buffer.length) break;

        const mask = masked ? buffer.subarray(cursor, cursor + 4) : null;
        cursor += maskLength;
        const payload = buffer.subarray(cursor, cursor + payloadLength);
        const decoded = Buffer.alloc(payload.length);

        for (let index = 0; index < payload.length; index += 1) {
            decoded[index] = masked ? payload[index] ^ mask[index % 4] : payload[index];
        }

        frames.push({
            opcode,
            payload: decoded
        });
        offset = cursor + payloadLength;
    }

    return {
        frames,
        remaining: buffer.subarray(offset)
    };
}

function parseSocketMessage(frame) {
    if (frame.opcode !== 0x1) {
        return null;
    }

    try {
        return JSON.parse(frame.payload.toString("utf8"));
    } catch {
        return null;
    }
}

function authenticateUpgrade(req) {
    const requestUrl = new URL(req.url, "http://localhost");
    if (requestUrl.pathname !== WS_PATH) {
        return { ok: false, status: 404, message: "Not Found" };
    }

    const token = requestUrl.searchParams.get("token");
    if (!token) {
        return { ok: false, status: 401, message: "Missing token" };
    }

    try {
        return {
            ok: true,
            user: verifyToken(token)
        };
    } catch {
        return { ok: false, status: 401, message: "Invalid token" };
    }
}

function rejectUpgrade(socket, status, message) {
    socket.write(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\n\r\n`);
    socket.destroy();
}

function setupSocketLifecycle(user, socket) {
    const connectionId = createConnectionId();
    const bucket = getBucket(user.id);
    const connection = {
        id: connectionId,
        socket,
        userId: user.id
    };
    bucket.set(connectionId, connection);

    writeFrame(socket, {
        opcode: 0x1,
        data: JSON.stringify({
            type: "ready",
            payload: {
                user_id: user.id,
                connection_id: connectionId,
                instance_id: REALTIME_INSTANCE_ID
            }
        })
    });

    let buffer = Buffer.alloc(0);

    socket.on("data", (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        const result = decodeFrames(buffer);
        buffer = result.remaining;

        for (const frame of result.frames) {
            if (frame.opcode === 0x8) {
                writeFrame(socket, { opcode: 0x8, data: frame.payload });
                socket.end();
                return;
            }
            if (frame.opcode === 0x9) {
                writeFrame(socket, { opcode: 0xA, data: frame.payload });
                continue;
            }
            if (frame.opcode === 0xA) {
                continue;
            }

            const message = parseSocketMessage(frame);
            if (!message) {
                continue;
            }

            if (message.type === "ping") {
                writeFrame(socket, {
                    opcode: 0x1,
                    data: JSON.stringify({
                        type: "pong",
                        payload: { at: Date.now() }
                    })
                });
            }
        }
    });

    const cleanup = () => {
        removeConnection(user.id, connectionId);
    };

    socket.on("close", cleanup);
    socket.on("end", cleanup);
    socket.on("error", cleanup);
}

function attachRealtimeServer(server) {
    startRealtimeEventPolling().catch((error) => {
        console.error("Failed to start realtime event polling:", error);
    });

    server.on("upgrade", (req, socket) => {
        const auth = authenticateUpgrade(req);
        if (!auth.ok) {
            rejectUpgrade(socket, auth.status, auth.message);
            return;
        }

        const websocketKey = req.headers["sec-websocket-key"];
        if (!websocketKey) {
            rejectUpgrade(socket, 400, "Bad Request");
            return;
        }

        const acceptKey = crypto
            .createHash("sha1")
            .update(websocketKey + MAGIC_WEBSOCKET_GUID)
            .digest("base64");

        socket.write(
            [
                "HTTP/1.1 101 Switching Protocols",
                "Upgrade: websocket",
                "Connection: Upgrade",
                `Sec-WebSocket-Accept: ${acceptKey}`,
                "\r\n"
            ].join("\r\n")
        );

        setupSocketLifecycle(auth.user, socket);
    });
}

async function getUnreadSummary(db, userId) {
    const chat = await db.prepare(`
        SELECT COUNT(*) AS count
        FROM messages
        WHERE receiver_id=? AND is_read=0
    `).get(userId);
    const interaction = await db.prepare(`
        SELECT COUNT(*) AS count
        FROM notifications
        WHERE user_id=? AND kind='interaction' AND is_read=0
    `).get(userId);
    const system = await db.prepare(`
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

async function pushUnreadSummary(db, userId) {
    const summary = await getUnreadSummary(db, userId);
    await publishUserEvent(db, userId, "unread_summary", summary);
    return summary;
}

async function getMessagePayload(db, messageId) {
    return await db.prepare(`
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
    `).get(messageId) || null;
}

async function pushConversationRefresh(db, userId, payload = {}) {
    await publishUserEvent(db, userId, "conversation_refresh", payload);
}

async function emitMessageCreated(db, messageId) {
    const message = await getMessagePayload(db, messageId);
    if (!message) {
        return null;
    }

    await publishUserEvent(db, message.sender_id, "message.created", message);
    await publishUserEvent(db, message.receiver_id, "message.created", message);
    await pushConversationRefresh(db, message.sender_id, { peer_id: message.receiver_id, message_id: message.id });
    await pushConversationRefresh(db, message.receiver_id, { peer_id: message.sender_id, message_id: message.id });
    await pushUnreadSummary(db, message.sender_id);
    await pushUnreadSummary(db, message.receiver_id);
    return message;
}

async function emitConversationRead(db, { readerId, peerId, lastReadMessageId }) {
    const payload = {
        reader_id: Number(readerId),
        peer_id: Number(peerId),
        last_read_message_id: Number(lastReadMessageId),
        read_at: new Date().toISOString()
    };

    await publishUserEvent(db, readerId, "message.read", payload);
    await publishUserEvent(db, peerId, "message.read", payload);
    await pushConversationRefresh(db, readerId, { peer_id: Number(peerId), last_read_message_id: Number(lastReadMessageId) });
    await pushConversationRefresh(db, peerId, { peer_id: Number(readerId), last_read_message_id: Number(lastReadMessageId) });
    await pushUnreadSummary(db, readerId);
    await pushUnreadSummary(db, peerId);
}

async function getNotificationPayload(db, notificationId) {
    const notification = await db.prepare(`
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

async function emitNotificationCreated(db, notificationId) {
    const notification = await getNotificationPayload(db, notificationId);
    if (!notification) {
        return null;
    }

    await publishUserEvent(db, notification.user_id, "notification.created", notification);
    await pushUnreadSummary(db, notification.user_id);
    return notification;
}

module.exports = {
    WS_PATH,
    REALTIME_INSTANCE_ID,
    attachRealtimeServer,
    getUnreadSummary,
    pushUnreadSummary,
    getMessagePayload,
    pushConversationRefresh,
    emitMessageCreated,
    emitConversationRead,
    getNotificationPayload,
    emitNotificationCreated
};
