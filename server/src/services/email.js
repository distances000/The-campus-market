const crypto = require("crypto");
const net = require("net");
const tls = require("tls");
const { logInfo } = require("../utils/logger");

function normalizeText(value) {
    return String(value || "").trim();
}

function generateVerificationCode() {
    return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

function getVerificationSecret() {
    const secret = normalizeText(process.env.EMAIL_CODE_SECRET || process.env.JWT_SECRET);
    if (!secret) {
        throw new Error("未配置邮箱验证码密钥");
    }
    return secret;
}

function getVerificationCodeHash(contact, purpose, code) {
    return crypto
        .createHmac("sha256", getVerificationSecret())
        .update([contact, purpose, code].join(":"))
        .digest("hex");
}

function getBooleanEnv(name, defaultValue) {
    const value = process.env[name];
    if (value === undefined || value === null || value === "") {
        return defaultValue;
    }
    return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function encodeBase64Utf8(value) {
    return Buffer.from(String(value || ""), "utf8").toString("base64");
}

function encodeHeaderValue(value) {
    const text = String(value || "");
    if (!/[^\x00-\x7F]/.test(text)) {
        return text;
    }
    return `=?UTF-8?B?${encodeBase64Utf8(text)}?=`;
}

function getVerificationEmailSubject(purpose) {
    const subjects = {
        register: "校园集市注册验证码"
    };
    return subjects[purpose] || "校园集市验证码";
}

function getVerificationEmailText({ code, purpose }) {
    const ttlSeconds = Number.parseInt(process.env.EMAIL_CODE_TTL_SECONDS || "300", 10);
    const ttlMinutes = Math.max(1, Math.ceil((Number.isFinite(ttlSeconds) ? ttlSeconds : 300) / 60));
    const baseText = {
        register: "你正在注册校园集市账号。"
    }[purpose] || "你正在使用校园集市验证码服务。";

    return [
        `${baseText}`,
        `验证码：${code}`,
        `有效期：${ttlMinutes} 分钟`,
        "如非本人操作，请忽略此邮件。"
    ].join("\r\n");
}

function buildVerificationEmail({ from, to, senderName, subject, text }) {
    const normalizedFrom = normalizeText(from);
    const normalizedTo = normalizeText(to);
    const headers = [
        `From: ${senderName ? `${encodeHeaderValue(senderName)} <${normalizedFrom}>` : normalizedFrom}`,
        `To: <${normalizedTo}>`,
        `Subject: ${encodeHeaderValue(subject)}`,
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=UTF-8",
        "Content-Transfer-Encoding: 8bit",
        "",
        text
    ];

    return headers.join("\r\n");
}

function createSmtpSession(socket) {
    let buffer = "";
    let currentLines = [];
    const queuedResponses = [];
    const waiters = [];

    function resolveResponse(response) {
        if (waiters.length) {
            waiters.shift().resolve(response);
            return;
        }
        queuedResponses.push(response);
    }

    function rejectWaiters(error) {
        while (waiters.length) {
            waiters.shift().reject(error);
        }
    }

    function flushBuffer() {
        let newlineIndex = buffer.indexOf("\n");
        while (newlineIndex >= 0) {
            const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
            buffer = buffer.slice(newlineIndex + 1);

            if (/^\d{3}[- ]/.test(line)) {
                currentLines.push(line);
                if (line[3] === " ") {
                    const response = {
                        code: Number(line.slice(0, 3)),
                        lines: currentLines.slice()
                    };
                    currentLines = [];
                    resolveResponse(response);
                }
            }

            newlineIndex = buffer.indexOf("\n");
        }
    }

    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
        buffer += chunk;
        flushBuffer();
    });
    socket.on("error", rejectWaiters);
    socket.on("close", () => {
        rejectWaiters(new Error("邮箱连接已关闭"));
    });

    function readResponse() {
        return new Promise((resolve, reject) => {
            if (queuedResponses.length) {
                resolve(queuedResponses.shift());
                return;
            }
            waiters.push({ resolve, reject });
            flushBuffer();
        });
    }

    function writeLine(line) {
        socket.write(line + "\r\n");
    }

    function writeRaw(text) {
        socket.write(text);
    }

    async function sendCommand(line, allowedCodes) {
        if (line) {
            writeLine(line);
        }
        const response = await readResponse();
        if (allowedCodes && !allowedCodes.includes(response.code)) {
            throw new Error(response.lines[response.lines.length - 1] || `邮件服务器返回 ${response.code}`);
        }
        return response;
    }

    async function close() {
        try {
            writeLine("QUIT");
        } catch {
            // ignore
        }
        socket.end();
    }

    return {
        sendCommand,
        readResponse,
        writeRaw,
        close
    };
}

function connectSmtp({ host, port, secure }) {
    return new Promise((resolve, reject) => {
        const socket = secure
            ? tls.connect({
                host,
                port,
                servername: host,
                rejectUnauthorized: process.env.EMAIL_SMTP_REJECT_UNAUTHORIZED === "false" ? false : true
            })
            : net.createConnection({ host, port });

        const onConnect = () => {
            socket.removeListener("error", onError);
            resolve(createSmtpSession(socket));
        };
        const onError = (error) => {
            socket.removeListener("secureConnect", onConnect);
            reject(error);
        };

        socket.once(secure ? "secureConnect" : "connect", onConnect);
        socket.once("error", onError);
        socket.setTimeout(Number.parseInt(process.env.EMAIL_SMTP_TIMEOUT_MS || "15000", 10), () => {
            socket.destroy(new Error("邮箱服务器连接超时"));
        });
    });
}

async function authenticateSmtp(session, username, password) {
    const ehloResponse = await session.sendCommand("EHLO localhost", [250]);
    const responseText = ehloResponse.lines.join("\n");
    const supportsPlain = /\bAUTH\b.*\bPLAIN\b/i.test(responseText);
    const supportsLogin = /\bAUTH\b.*\bLOGIN\b/i.test(responseText) || /\bAUTH LOGIN\b/i.test(responseText);

    if (supportsPlain) {
        const authToken = encodeBase64Utf8(`\u0000${username}\u0000${password}`);
        try {
            const authResponse = await session.sendCommand(`AUTH PLAIN ${authToken}`, [235]);
            if (authResponse.code === 235) {
                return;
            }
        } catch (error) {
            if (!supportsLogin) {
                throw error;
            }
        }
    }

    if (supportsLogin) {
        await session.sendCommand("AUTH LOGIN", [334]);
        await session.sendCommand(encodeBase64Utf8(username), [334]);
        await session.sendCommand(encodeBase64Utf8(password), [235]);
        return;
    }

    throw new Error("邮件服务器不支持 SMTP 登录");
}

async function sendVerificationEmail({ contact, code, purpose }) {
    const provider = normalizeText(process.env.EMAIL_PROVIDER || "console");
    const subject = getVerificationEmailSubject(purpose);
    const text = getVerificationEmailText({ code, purpose });

    if (provider === "console") {
        logInfo("email.console_code_generated", "控制台邮箱验证码已生成", {
            purpose,
            contact,
            code
        });
        return { provider, success: true };
    }

    if (provider !== "smtp") {
        throw new Error(`不支持的邮箱服务提供方: ${provider}`);
    }

    const host = normalizeText(process.env.EMAIL_SMTP_HOST || "smtp.qiye.aliyun.com");
    const port = Number.parseInt(process.env.EMAIL_SMTP_PORT || "465", 10);
    const secure = process.env.EMAIL_SMTP_SECURE === undefined
        ? port === 465
        : getBooleanEnv("EMAIL_SMTP_SECURE", true);
    const username = normalizeText(process.env.EMAIL_SMTP_USER || process.env.EMAIL_USER);
    const password = normalizeText(process.env.EMAIL_SMTP_PASS || process.env.EMAIL_PASSWORD || process.env.EMAIL_AUTH_CODE);
    const from = normalizeText(process.env.EMAIL_FROM || username);
    const senderName = normalizeText(process.env.EMAIL_SENDER_NAME || "校园集市");

    if (!host || !port || !username || !password || !from) {
        throw new Error("未配置完整的邮箱 SMTP 参数");
    }

    const session = await connectSmtp({ host, port, secure });
    try {
        await session.sendCommand(null, [220]);
        await authenticateSmtp(session, username, password);
        await session.sendCommand(`MAIL FROM:<${from}>`, [250]);
        await session.sendCommand(`RCPT TO:<${contact}>`, [250, 251]);
        await session.sendCommand("DATA", [354]);

        const message = buildVerificationEmail({
            from,
            to: contact,
            senderName,
            subject,
            text
        });
        session.writeRaw(message + "\r\n.\r\n");
        const dataResponse = await session.readResponse();
        if (dataResponse.code !== 250) {
            throw new Error(dataResponse.lines[dataResponse.lines.length - 1] || `邮件服务器返回 ${dataResponse.code}`);
        }
        await session.close();
        return { provider, success: true };
    } catch (error) {
        await session.close().catch(() => {});
        throw error;
    }
}

module.exports = {
    generateVerificationCode,
    getVerificationCodeHash,
    sendVerificationEmail
};
