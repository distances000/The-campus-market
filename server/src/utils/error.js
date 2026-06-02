class AppError extends Error {
    constructor(message, options = {}) {
        super(message);
        this.name = "AppError";
        this.status = Number.isInteger(options.status) ? options.status : 400;
        this.code = Number.isInteger(options.code) ? options.code : this.status;
        this.expose = options.expose !== false;
    }
}

function createAppError(message, options = {}) {
    return new AppError(message, options);
}

function getUserFacingMessage(error, fallbackMessage) {
    if (error instanceof AppError && error.expose && error.message) {
        return error.message;
    }
    return fallbackMessage;
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

function logServerError(error, context = "") {
    const prefix = context ? `[${context}]` : "[server]";
    if (error instanceof Error) {
        console.error(prefix, error.stack || error.message);
        return;
    }
    console.error(prefix, error);
}

module.exports = {
    AppError,
    createAppError,
    getUserFacingMessage,
    getStatusCode,
    getErrorCode,
    logServerError
};
