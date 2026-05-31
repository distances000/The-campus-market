let currentToken = "";
let eventSource = null;
const listeners = new Set();

function parsePayload(event) {
    try {
        return JSON.parse(event.data);
    } catch {
        return null;
    }
}

function dispatch(type, payload) {
    for (const listener of [...listeners]) {
        const handler = listener?.[type];
        if (typeof handler === "function") {
            handler(payload);
        }
    }
}

function bindEventSource(source) {
    source.addEventListener("ready", (event) => {
        dispatch("onReady", parsePayload(event));
    });
    source.addEventListener("message", (event) => {
        dispatch("onMessage", parsePayload(event));
    });
    source.addEventListener("notification", (event) => {
        dispatch("onNotification", parsePayload(event));
    });
    source.addEventListener("unread_summary", (event) => {
        dispatch("onUnreadSummary", parsePayload(event));
    });
    source.addEventListener("conversation_refresh", (event) => {
        dispatch("onConversationRefresh", parsePayload(event));
    });
    source.onerror = () => {
        dispatch("onError");
    };
}

function createEventSource(token) {
    const url = `/api/messages/stream?token=${encodeURIComponent(token)}`;
    const source = new EventSource(url);
    bindEventSource(source);
    return source;
}

export function ensureMessageStream(token) {
    if (!token) {
        closeMessageStream();
        return null;
    }
    if (eventSource && currentToken === token) {
        return eventSource;
    }
    closeMessageStream();
    currentToken = token;
    eventSource = createEventSource(token);
    return eventSource;
}

export function subscribeMessageStream(token, handlers = {}) {
    if (!token) {
        return () => {};
    }
    ensureMessageStream(token);
    listeners.add(handlers);

    return () => {
        listeners.delete(handlers);
        if (!listeners.size) {
            closeMessageStream();
        }
    };
}

export function closeMessageStream() {
    if (eventSource) {
        eventSource.close();
        eventSource = null;
    }
    currentToken = "";
}
