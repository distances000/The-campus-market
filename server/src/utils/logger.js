const crypto = require("crypto");
const { classifyError } = require("./error");

function createRequestId() {
    return crypto.randomUUID();
}

function getClientIp(req) {
    const forwarded = req?.headers?.["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.trim()) {
        return forwarded.split(",")[0].trim();
    }
    return req?.ip || req?.socket?.remoteAddress || "";
}

function sanitizeValue(value) {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }
    if (Array.isArray(value)) {
        return value.map(sanitizeValue).filter((item) => item !== undefined);
    }
    if (typeof value === "object") {
        const next = {};
        for (const [key, item] of Object.entries(value)) {
            const sanitized = sanitizeValue(item);
            if (sanitized !== undefined) {
                next[key] = sanitized;
            }
        }
        return Object.keys(next).length ? next : undefined;
    }
    if (typeof value === "string") {
        return value.length > 500 ? value.slice(0, 500) + "..." : value;
    }
    return value;
}

function buildRequestMeta(req, extra = {}) {
    return sanitizeValue({
        request_id: req?.requestId,
        method: req?.method,
        path: req?.originalUrl || req?.url,
        ip: getClientIp(req),
        user_id: req?.user?.id,
        ...extra
    }) || {};
}

function writeLog(level, event, message, meta = {}) {
    const entry = {
        timestamp: new Date().toISOString(),
        level,
        event,
        message,
        ...sanitizeValue(meta)
    };
    const line = JSON.stringify(entry);

    if (level === "error") {
        console.error(line);
        return;
    }
    if (level === "warn") {
        console.warn(line);
        return;
    }
    console.log(line);
}

function logInfo(event, message, meta = {}) {
    writeLog("info", event, message, meta);
}

function logWarn(event, message, meta = {}) {
    writeLog("warn", event, message, meta);
}

function buildErrorMeta(error, meta = {}) {
    const classification = classifyError(error);
    return {
        ...meta,
        error_kind: classification.kind,
        error_status: classification.status,
        error_code: classification.code,
        error_name: error?.name,
        error_message: error?.message,
        error_stack: error?.stack
    };
}

function logError(event, message, error, meta = {}) {
    writeLog("error", event, message, buildErrorMeta(error, meta));
}

function logByError(event, message, error, meta = {}) {
    const classification = classifyError(error);
    writeLog(classification.logLevel, event, message, buildErrorMeta(error, meta));
}

function attachRequestContext(req, res, next) {
    req.requestId = createRequestId();
    res.setHeader("x-request-id", req.requestId);
    next();
}

module.exports = {
    attachRequestContext,
    buildRequestMeta,
    logInfo,
    logWarn,
    logError,
    logByError
};
