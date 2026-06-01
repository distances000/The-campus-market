const crypto = require("crypto");

function normalizeText(value) {
    return String(value || "").trim();
}

function generateSmsCode() {
    return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

function getSmsCodeSecret() {
    const secret = normalizeText(process.env.SMS_CODE_SECRET || process.env.JWT_SECRET);
    if (!secret) {
        throw new Error("未配置短信验证码密钥");
    }
    return secret;
}

function getSmsCodeHash(phone, purpose, code) {
    return crypto
        .createHmac("sha256", getSmsCodeSecret())
        .update([phone, purpose, code].join(":"))
        .digest("hex");
}

async function sendSmsCode({ phone, code, purpose }) {
    const provider = normalizeText(process.env.SMS_PROVIDER || "console");

    if (provider === "console") {
        console.log(`[SMS][${purpose}] ${phone}: ${code}`);
        return { provider, success: true };
    }

    if (provider === "webhook") {
        const webhookUrl = normalizeText(process.env.SMS_WEBHOOK_URL);
        if (!webhookUrl) {
            throw new Error("未配置 SMS_WEBHOOK_URL");
        }

        const headers = {
            "content-type": "application/json"
        };
        const webhookSecret = normalizeText(process.env.SMS_WEBHOOK_SECRET);
        if (webhookSecret) {
            headers["x-webhook-secret"] = webhookSecret;
        }

        const response = await fetch(webhookUrl, {
            method: "POST",
            headers,
            body: JSON.stringify({
                phone,
                code,
                purpose
            })
        });

        if (!response.ok) {
            throw new Error(`短信服务响应异常: ${response.status}`);
        }

        return { provider, success: true };
    }

    throw new Error(`不支持的短信服务提供方: ${provider}`);
}

module.exports = {
    generateSmsCode,
    getSmsCodeHash,
    sendSmsCode
};
