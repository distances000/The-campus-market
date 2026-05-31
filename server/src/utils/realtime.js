const crypto = require("crypto");
const { URL } = require("url");
const { verifyToken } = require("../middleware/auth");

const WS_PATH = "/ws";
const MAGIC_WEBSOCKET_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const connections = new Map();

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
                connection_id: connectionId
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
    sendEvent(userId, "unread_summary", await getUnreadSummary(db, userId));
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

function pushConversationRefresh(userId, payload = {}) {
    sendEvent(userId, "conversation_refresh", payload);
}

async function emitMessageCreated(db, messageId) {
    const message = await getMessagePayload(db, messageId);
    if (!message) {
        return null;
    }

    sendEvent(message.sender_id, "message.created", message);
    sendEvent(message.receiver_id, "message.created", message);
    pushConversationRefresh(message.sender_id, { peer_id: message.receiver_id, message_id: message.id });
    pushConversationRefresh(message.receiver_id, { peer_id: message.sender_id, message_id: message.id });
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

    sendEvent(readerId, "message.read", payload);
    sendEvent(peerId, "message.read", payload);
    pushConversationRefresh(readerId, { peer_id: Number(peerId), last_read_message_id: Number(lastReadMessageId) });
    pushConversationRefresh(peerId, { peer_id: Number(readerId), last_read_message_id: Number(lastReadMessageId) });
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

    sendEvent(notification.user_id, "notification.created", notification);
    await pushUnreadSummary(db, notification.user_id);
    return notification;
}

module.exports = {
    WS_PATH,
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
