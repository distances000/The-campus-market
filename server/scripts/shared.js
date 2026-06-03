const http = require("http");
const { loadAppEnv } = require("../src/config/loadEnv");

loadAppEnv();

const DEFAULT_API_HOST = process.env.SMOKE_API_HOST || "127.0.0.1";
const DEFAULT_API_PORT = Number(process.env.SMOKE_API_PORT || 3000);
const DEFAULT_DATABASE_URL = process.env.DATABASE_URL || "";

function getApiBase() {
    return {
        hostname: DEFAULT_API_HOST,
        port: DEFAULT_API_PORT
    };
}

function getDatabaseUrl() {
    return DEFAULT_DATABASE_URL;
}

function buildJsonRequest(method, path, body, token) {
    const base = getApiBase();
    return new Promise((resolve, reject) => {
        const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
        const req = http.request({
            ...base,
            path,
            method,
            headers: {
                "Content-Type": "application/json",
                ...(payload ? { "Content-Length": payload.length } : {}),
                ...(token ? { Authorization: `Bearer ${token}` } : {})
            }
        }, (res) => {
            let raw = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => {
                raw += chunk;
            });
            res.on("end", () => {
                try {
                    resolve({
                        status: res.statusCode,
                        data: raw ? JSON.parse(raw) : {}
                    });
                } catch (error) {
                    reject(new Error(`Invalid JSON response for ${method} ${path}: ${raw}`));
                }
            });
        });
        req.on("error", reject);
        if (payload) {
            req.write(payload);
        }
        req.end();
    });
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForApiReady({ timeoutMs = 30000, intervalMs = 1000 } = {}) {
    const deadline = Date.now() + timeoutMs;
    let lastError = null;

    while (Date.now() < deadline) {
        try {
            const result = await buildJsonRequest("GET", "/api/health");
            if (result.status === 200 && result.data && result.data.code === 200) {
                return true;
            }
            lastError = new Error(`Unexpected health response: ${JSON.stringify(result.data)}`);
        } catch (error) {
            lastError = error;
        }

        await sleep(intervalMs);
    }

    throw new Error(`API 未就绪，请先启动后端服务: ${lastError ? lastError.message : "timeout"}`);
}

module.exports = {
    buildJsonRequest,
    getApiBase,
    getDatabaseUrl,
    waitForApiReady
};
