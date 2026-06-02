const path = require("path");
const { loadAppEnv } = require("./loadEnv");

loadAppEnv();

const DEFAULT_JWT_SECRET = "campus-market-secret-key-2026";
const DEFAULT_UPLOAD_PUBLIC_PREFIX = "/uploads";
const DEFAULT_UPLOAD_DIR = path.resolve(__dirname, "..", "..", "uploads");

function normalizeText(value) {
    return String(value || "").trim();
}

function getBooleanEnv(name, defaultValue = false) {
    const value = normalizeText(process.env[name]);
    if (!value) {
        return defaultValue;
    }
    return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function getNumberEnv(name, defaultValue) {
    const value = normalizeText(process.env[name]);
    if (!value) {
        return defaultValue;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : defaultValue;
}

function isPlaceholderSecret(value) {
    const normalized = normalizeText(value).toLowerCase();
    if (!normalized) {
        return true;
    }

    return [
        "change-this",
        "your-secret",
        "example",
        "placeholder",
        DEFAULT_JWT_SECRET.toLowerCase()
    ].some((keyword) => normalized.includes(keyword));
}

function normalizeBaseUrl(value) {
    const raw = normalizeText(value);
    if (!raw) {
        return "";
    }
    return raw.replace(/\/+$/, "");
}

function normalizeUploadPublicPrefix(value) {
    const raw = normalizeText(value) || DEFAULT_UPLOAD_PUBLIC_PREFIX;
    const withoutTrailingSlash = raw.replace(/\/+$/, "");
    if (!withoutTrailingSlash.startsWith("/")) {
        return `/${withoutTrailingSlash}`;
    }
    return withoutTrailingSlash || DEFAULT_UPLOAD_PUBLIC_PREFIX;
}

function resolveUploadDir(value) {
    const raw = normalizeText(value);
    if (!raw) {
        return DEFAULT_UPLOAD_DIR;
    }
    return path.isAbsolute(raw) ? raw : path.resolve(__dirname, "..", "..", raw);
}

function getRuntimeConfig() {
    const nodeEnv = normalizeText(process.env.NODE_ENV) || "development";
    const appBaseUrl = normalizeBaseUrl(process.env.APP_BASE_URL);
    const appPrimaryDomain = normalizeText(process.env.APP_PRIMARY_DOMAIN);
    const domains = normalizeText(process.env.DOMAINS);
    const enableHttps = getBooleanEnv("ENABLE_HTTPS", false);
    const emailProvider = normalizeText(process.env.EMAIL_PROVIDER || "console").toLowerCase();

    return {
        nodeEnv,
        isProduction: nodeEnv === "production",
        port: getNumberEnv("PORT", 3000),
        appBaseUrl,
        appPrimaryDomain,
        domains,
        enableHttps,
        jwtSecret: normalizeText(process.env.JWT_SECRET),
        adminBootstrapKey: normalizeText(process.env.ADMIN_BOOTSTRAP_KEY),
        databaseUrl: normalizeText(process.env.DATABASE_URL),
        mysqlHost: normalizeText(process.env.MYSQL_HOST),
        mysqlPort: getNumberEnv("MYSQL_PORT", 3306),
        mysqlUser: normalizeText(process.env.MYSQL_USER),
        mysqlPassword: normalizeText(process.env.MYSQL_PASSWORD),
        mysqlDatabase: normalizeText(process.env.MYSQL_DATABASE),
        uploadDir: resolveUploadDir(process.env.UPLOAD_DIR),
        uploadPublicPrefix: normalizeUploadPublicPrefix(process.env.UPLOAD_PUBLIC_PREFIX),
        uploadMaxBodySize: normalizeText(process.env.UPLOAD_MAX_BODY_SIZE || "20m"),
        emailProvider,
        emailSenderName: normalizeText(process.env.EMAIL_SENDER_NAME || "校园集市"),
        emailCodeSecret: normalizeText(process.env.EMAIL_CODE_SECRET),
        emailSmtpHost: normalizeText(process.env.EMAIL_SMTP_HOST),
        emailSmtpPort: getNumberEnv("EMAIL_SMTP_PORT", 465),
        emailSmtpUser: normalizeText(process.env.EMAIL_SMTP_USER || process.env.EMAIL_USER),
        emailSmtpPass: normalizeText(process.env.EMAIL_SMTP_PASS || process.env.EMAIL_PASSWORD || process.env.EMAIL_AUTH_CODE),
        emailFrom: normalizeText(process.env.EMAIL_FROM),
        letsencryptEmail: normalizeText(process.env.LETSENCRYPT_EMAIL),
        httpPort: getNumberEnv("HTTP_PORT", 80),
        httpsPort: getNumberEnv("HTTPS_PORT", 443)
    };
}

function validateRuntimeConfig(config = getRuntimeConfig()) {
    const errors = [];

    if (!Number.isInteger(config.port) || config.port <= 0) {
        errors.push("PORT 必须是正整数。");
    }

    if (!config.uploadDir) {
        errors.push("UPLOAD_DIR 未配置。");
    }

    if (!config.uploadPublicPrefix.startsWith("/")) {
        errors.push("UPLOAD_PUBLIC_PREFIX 必须以 / 开头。");
    }

    if (config.isProduction) {
        if (!config.databaseUrl) {
            const requiredMysqlFields = [
                ["MYSQL_HOST", config.mysqlHost],
                ["MYSQL_USER", config.mysqlUser],
                ["MYSQL_PASSWORD", config.mysqlPassword],
                ["MYSQL_DATABASE", config.mysqlDatabase]
            ];
            requiredMysqlFields.forEach(([name, value]) => {
                if (!value) {
                    errors.push(`生产环境缺少 ${name}。`);
                }
            });
        }

        if (!config.appBaseUrl) {
            errors.push("生产环境必须配置 APP_BASE_URL。");
        }

        if (!config.appPrimaryDomain) {
            errors.push("生产环境必须配置 APP_PRIMARY_DOMAIN。");
        }

        if (!config.jwtSecret || isPlaceholderSecret(config.jwtSecret) || config.jwtSecret.length < 24) {
            errors.push("生产环境必须配置足够强度的 JWT_SECRET，且不能使用默认值或占位值。");
        }

        if (!config.adminBootstrapKey || config.adminBootstrapKey.length < 16 || isPlaceholderSecret(config.adminBootstrapKey)) {
            errors.push("生产环境必须配置足够强度的 ADMIN_BOOTSTRAP_KEY。");
        }

        if (config.enableHttps) {
            if (!config.appBaseUrl.startsWith("https://")) {
                errors.push("开启 ENABLE_HTTPS=true 时，APP_BASE_URL 必须使用 https://。");
            }
            if (!config.domains) {
                errors.push("开启 ENABLE_HTTPS=true 时，必须配置 DOMAINS。");
            }
            if (!config.letsencryptEmail) {
                errors.push("开启 ENABLE_HTTPS=true 时，必须配置 LETSENCRYPT_EMAIL。");
            }
        }

        if (config.emailProvider !== "smtp") {
            errors.push("生产环境必须配置 EMAIL_PROVIDER=smtp。");
        }

        if (config.emailProvider === "smtp") {
            [
                ["EMAIL_SMTP_HOST", config.emailSmtpHost],
                ["EMAIL_SMTP_USER", config.emailSmtpUser],
                ["EMAIL_SMTP_PASS", config.emailSmtpPass],
                ["EMAIL_FROM", config.emailFrom],
                ["EMAIL_CODE_SECRET", config.emailCodeSecret]
            ].forEach(([name, value]) => {
                if (!value) {
                    errors.push(`生产环境缺少 ${name}。`);
                }
            });
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

function formatRuntimeSummary(config = getRuntimeConfig()) {
    return {
        node_env: config.nodeEnv,
        port: config.port,
        app_base_url: config.appBaseUrl || "(未配置)",
        app_primary_domain: config.appPrimaryDomain || "(未配置)",
        https_enabled: config.enableHttps,
        email_provider: config.emailProvider,
        upload_dir: config.uploadDir,
        upload_public_prefix: config.uploadPublicPrefix,
        http_port: config.httpPort,
        https_port: config.httpsPort,
        database_mode: config.databaseUrl ? "DATABASE_URL" : "MYSQL_*"
    };
}

module.exports = {
    DEFAULT_JWT_SECRET,
    DEFAULT_UPLOAD_DIR,
    DEFAULT_UPLOAD_PUBLIC_PREFIX,
    getRuntimeConfig,
    validateRuntimeConfig,
    formatRuntimeSummary
};
