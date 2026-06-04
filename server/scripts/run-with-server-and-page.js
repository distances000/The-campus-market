const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");
const { getApiBase, waitForApiReady } = require("./shared");
const {
    spawnNodeProcess,
    stopChild,
    waitForChildExit
} = require("./process-helpers");

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getNpmCommand() {
    return process.platform === "win32" ? "npm.cmd" : "npm";
}

function requestPage(host, port, pagePath) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: host,
            port,
            path: pagePath,
            method: "GET"
        }, (res) => {
            let raw = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => {
                raw += chunk;
            });
            res.on("end", () => {
                resolve({
                    status: res.statusCode,
                    body: raw
                });
            });
        });

        req.on("error", reject);
        req.end();
    });
}

async function waitForPageReady(host, port, timeoutMs = 60000, intervalMs = 1000) {
    const deadline = Date.now() + timeoutMs;
    let lastError = null;

    while (Date.now() < deadline) {
        try {
            const result = await requestPage(host, port, "/home");
            if (result.status === 200 && result.body.includes('<div id="app"></div>')) {
                return true;
            }
            lastError = new Error(`页面响应异常: ${result.status}`);
        } catch (error) {
            lastError = error;
        }

        await sleep(intervalMs);
    }

    throw new Error(`页面服务未就绪: ${lastError ? lastError.message : "timeout"}`);
}

async function ensureClientDist(clientDir) {
    const distIndex = path.join(clientDir, "dist", "index.html");
    if (fs.existsSync(distIndex)) {
        return;
    }

    await new Promise((resolve, reject) => {
        const build = spawn(getNpmCommand(), ["run", "build"], {
            cwd: clientDir,
            stdio: "inherit"
        });

        build.on("exit", (code) => {
            if (code === 0) {
                resolve();
                return;
            }

            reject(new Error(`前端构建失败，退出码 ${code}`));
        });
        build.on("error", reject);
    });
}

async function main() {
    const targetScript = process.argv[2];
    if (!targetScript) {
        throw new Error("请传入要执行的脚本路径");
    }

    const serverDir = path.resolve(__dirname, "..");
    const clientDir = path.resolve(serverDir, "..", "client");
    const targetPath = path.resolve(serverDir, targetScript);
    const apiBase = getApiBase();
    const pageHost = process.env.SMOKE_PAGE_HOST || "127.0.0.1";
    const pagePort = Number(process.env.SMOKE_PAGE_PORT || 4173);
    const sharedEnv = {
        ...process.env,
        PORT: String(apiBase.port),
        SMOKE_API_HOST: apiBase.hostname,
        SMOKE_API_PORT: String(apiBase.port),
        SMOKE_PAGE_HOST: pageHost,
        SMOKE_PAGE_PORT: String(pagePort),
        ADMIN_BOOTSTRAP_KEY: process.env.ADMIN_BOOTSTRAP_KEY || "test-bootstrap-key"
    };

    const server = spawnNodeProcess(path.join(serverDir, "src", "index.js"), {
        cwd: serverDir,
        env: sharedEnv,
        label: "server"
    });

    let pageServer;
    let target;

    try {
        await waitForApiReady({ timeoutMs: 60000, intervalMs: 1000 });
        await ensureClientDist(clientDir);

        pageServer = spawnNodeProcess(path.join(serverDir, "scripts", "serve-client-dist.js"), {
            cwd: serverDir,
            env: sharedEnv,
            label: "page"
        });

        await waitForPageReady(pageHost, pagePort);

        target = spawnNodeProcess(targetPath, {
            cwd: serverDir,
            env: sharedEnv
        });

        process.exitCode = await waitForChildExit(target);
    } catch (error) {
        console.error(error && error.stack ? error.stack : error);
        process.exitCode = 1;
    } finally {
        await stopChild(target);
        await stopChild(pageServer);
        await stopChild(server);
    }
}

main().catch((error) => {
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
});
