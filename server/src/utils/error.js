const ERROR_KIND = {
    BUSINESS: "business",
    SYSTEM: "system"
};

class AppError extends Error {
    constructor(message, options = {}) {
        super(message);
        this.name = "AppError";
        this.status = Number.isInteger(options.status) ? options.status : 400;
        this.code = Number.isInteger(options.code) ? options.code : this.status;
        this.kind = options.kind === ERROR_KIND.SYSTEM ? ERROR_KIND.SYSTEM : ERROR_KIND.BUSINESS;
        this.expose = options.expose !== false;
    }
}

function createAppError(message, options = {}) {
    return new AppError(message, {
        ...options,
        kind: ERROR_KIND.BUSINESS
    });
}

function createSystemError(message, options = {}) {
    return new AppError(message, {
        status: 500,
        code: 500,
        expose: false,
        ...options,
        kind: ERROR_KIND.SYSTEM
    });
}

function isBusinessError(error) {
    return error instanceof AppError && error.kind === ERROR_KIND.BUSINESS;
}

function isSystemError(error) {
    return error instanceof AppError && error.kind === ERROR_KIND.SYSTEM;
}

function getStatusCode(error, fallbackStatus = 500) {
    if (error instanceof AppError && Number.isInteger(error.status)) {
        return error.status;
    }
    return fallbackStatus;
}

function getErrorCode(error, fallbackCode) {
    if (error instanceof AppError && Number.isInteger(error.code)) {
        return error.code;
    }
    return fallbackCode;
}

function classifyError(error, fallbackMessage = "服务暂时不可用，请稍后再试") {
    const business = isBusinessError(error);
    const system = isSystemError(error) || !business;
    const status = getStatusCode(error, 500);
    const code = getErrorCode(error, status);

    return {
        kind: business ? ERROR_KIND.BUSINESS : ERROR_KIND.SYSTEM,
        status,
        code,
        expose: business && error?.expose !== false,
        logLevel: business ? "warn" : "error",
        userMessage: business && error?.message ? error.message : fallbackMessage,
        shouldAlert: system && status >= 500
    };
}

function getUserFacingMessage(error, fallbackMessage) {
    return classifyError(error, fallbackMessage).userMessage;
}

function logServerError(error, context = "") {
    const prefix = context ? `[${context}]` : "[server]";
    if (error instanceof Error) {
        console.error(prefix, error.stack || error.message);
        return;
    }
    console.error(prefix, error);
}

function isDuplicateEntryError(error) {
    return error?.code === "ER_DUP_ENTRY" || error?.errno === 1062;
}

module.exports = {
    ERROR_KIND,
    AppError,
    createAppError,
    createSystemError,
    classifyError,
    getUserFacingMessage,
    getStatusCode,
    getErrorCode,
    logServerError,
    isDuplicateEntryError,
    isBusinessError,
    isSystemError
};
