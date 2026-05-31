let currentToken = "";
let socket = null;
let reconnectTimer = null;
let listeners = new Set();
let manuallyClosed = false;

function buildWebSocketUrl(token) {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;
}

function dispatch(type, payload) {
    for (const listener of [...listeners]) {
        const handler = listener?.[type];
        if (typeof handler === "function") {
            handler(payload);
        }
    }
}

function clearReconnectTimer() {
    if (!reconnectTimer) {
        return;
    }
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
}

function scheduleReconnect() {
    if (manuallyClosed || !currentToken || reconnectTimer) {
        return;
    }
    reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        connect();
    }, 1500);
}

function handleSocketMessage(event) {
    let packet = null;
    try {
        packet = JSON.parse(event.data);
    } catch {
        return;
    }
    if (!packet?.type) {
        return;
    }

    switch (packet.type) {
        case "ready":
            dispatch("onReady", packet.payload);
            break;
        case "message.created":
            dispatch("onMessageCreated", packet.payload);
            break;
        case "message.read":
            dispatch("onMessageRead", packet.payload);
            break;
        case "notification.created":
            dispatch("onNotificationCreated", packet.payload);
            break;
        case "unread_summary":
            dispatch("onUnreadSummary", packet.payload);
            break;
        case "conversation_refresh":
            dispatch("onConversationRefresh", packet.payload);
            break;
        case "pong":
            dispatch("onPong", packet.payload);
            break;
        default:
            dispatch("onUnknown", packet);
            break;
    }
}

function cleanupSocket() {
    if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        socket = null;
    }
}

function connect() {
    if (!currentToken) {
        return null;
    }
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        return socket;
    }

    manuallyClosed = false;
    const nextSocket = new WebSocket(buildWebSocketUrl(currentToken));
    socket = nextSocket;

    nextSocket.onopen = () => {
        clearReconnectTimer();
        dispatch("onOpen");
    };
    nextSocket.onmessage = handleSocketMessage;
    nextSocket.onerror = () => {
        dispatch("onError");
    };
    nextSocket.onclose = () => {
        cleanupSocket();
        dispatch("onClose");
        scheduleReconnect();
    };

    return nextSocket;
}

export function ensureMessageStream(token) {
    if (!token) {
        closeMessageStream();
        return null;
    }
    if (currentToken !== token) {
        closeMessageStream();
        currentToken = token;
    }
    return connect();
}

export function subscribeMessageStream(token, handlers = {}) {
    if (!token) {
        return () => {};
    }
    listeners.add(handlers);
    ensureMessageStream(token);

    return () => {
        listeners.delete(handlers);
        if (!listeners.size) {
            closeMessageStream();
        }
    };
}

export function sendStreamMessage(packet) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        return false;
    }
    socket.send(JSON.stringify(packet));
    return true;
}

export function closeMessageStream() {
    manuallyClosed = true;
    clearReconnectTimer();
    currentToken = "";
    if (socket) {
        socket.close();
        cleanupSocket();
    }
}
