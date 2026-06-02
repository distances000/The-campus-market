const { createAppError } = require("./error");

function normalizeText(value) {
    return String(value || "").trim();
}

function ensurePositiveInt(value, fieldName = "ID") {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw createAppError(`${fieldName}不合法`);
    }
    return parsed;
}

function ensureOptionalEnum(value, allowedValues, fieldName, options = {}) {
    const normalized = normalizeText(value);
    if (!normalized) {
        return options.defaultValue;
    }
    if (!allowedValues.includes(normalized)) {
        throw createAppError(`${fieldName}不合法`);
    }
    return normalized;
}

function ensureRequiredText(value, fieldName, options = {}) {
    const normalized = normalizeText(value);
    const minLength = Number.isInteger(options.minLength) ? options.minLength : 1;
    const maxLength = Number.isInteger(options.maxLength) ? options.maxLength : null;

    if (!normalized || normalized.length < minLength) {
        throw createAppError(`请填写${fieldName}`);
    }
    if (maxLength !== null && normalized.length > maxLength) {
        throw createAppError(`${fieldName}不能超过 ${maxLength} 个字`);
    }
    return normalized;
}

function ensureOptionalText(value, fieldName, options = {}) {
    const normalized = normalizeText(value);
    const maxLength = Number.isInteger(options.maxLength) ? options.maxLength : null;
    if (!normalized) {
        return "";
    }
    if (maxLength !== null && normalized.length > maxLength) {
        throw createAppError(`${fieldName}不能超过 ${maxLength} 个字`);
    }
    return normalized;
}

function ensurePrice(value, fieldName = "价格") {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        throw createAppError(`${fieldName}不合法`);
    }
    return parsed;
}

function ensurePagination(query, options = {}) {
    const maxPageSize = Number.isInteger(options.maxPageSize) ? options.maxPageSize : 100;
    const defaultPageSize = Number.isInteger(options.defaultPageSize) ? options.defaultPageSize : 20;
    const page = query.page === undefined ? 1 : ensurePositiveInt(query.page, "页码");
    const pageSize = query.page_size === undefined
        ? defaultPageSize
        : ensurePositiveInt(query.page_size, "每页数量");

    if (pageSize > maxPageSize) {
        throw createAppError(`每页数量不能超过 ${maxPageSize}`);
    }

    return {
        page,
        pageSize,
        offset: (page - 1) * pageSize
    };
}

module.exports = {
    normalizeText,
    ensurePositiveInt,
    ensureOptionalEnum,
    ensureRequiredText,
    ensureOptionalText,
    ensurePrice,
    ensurePagination
};
