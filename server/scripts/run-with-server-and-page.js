const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");
const {
    getApiBase,
    waitForApiReady
} = require("./shared");

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
            lastError = new Error(`Unexpected page response: ${result.status}`);
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

function spawnServer(scriptPath, cwd, env) {
    const child = spawn(process.execPath, [scriptPath], {
        cwd,
        env,
        stdio: ["ignore", "pipe", "pipe"]
    });

    child.stdout.on("data", (chunk) => {
        process.stdout.write(`[server] ${chunk}`);
    });

    child.stderr.on("data", (chunk) => {
        process.stderr.write(`[server] ${chunk}`);
    });

    return child;
}

function spawnPageServer(serverDir, host, port, env) {
    const child = spawn(process.execPath, [path.join(serverDir, "scripts", "serve-client-dist.js")], {
        cwd: serverDir,
        env: {
            ...env,
            SMOKE_PAGE_HOST: host,
            SMOKE_PAGE_PORT: String(port)
        },
        stdio: ["ignore", "pipe", "pipe"]
    });

    child.stdout.on("data", (chunk) => {
        process.stdout.write(`[page] ${chunk}`);
    });

    child.stderr.on("data", (chunk) => {
        process.stderr.write(`[page] ${chunk}`);
    });

    return child;
}

function stopChild(child) {
    return new Promise((resolve) => {
        if (!child || child.killed || child.exitCode !== null || child.signalCode !== null) {
            resolve();
            return;
        }

        const timer = setTimeout(() => {
            if (!child.killed) {
                child.kill("SIGKILL");
            }
        }, 5000);

        child.once("exit", () => {
            clearTimeout(timer);
            resolve();
        });

        child.kill("SIGTERM");
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
        SMOKE_PAGE_PORT: String(pagePort)
    };

    const server = spawnServer(path.join(serverDir, "src", "index.js"), serverDir, sharedEnv);

    try {
        await waitForApiReady({ timeoutMs: 60000, intervalMs: 1000 });
        await ensureClientDist(clientDir);

        const pageServer = spawnPageServer(serverDir, pageHost, pagePort, sharedEnv);
        try {
            await waitForPageReady(pageHost, pagePort);

            const target = spawn(process.execPath, [targetPath], {
                cwd: serverDir,
                env: sharedEnv,
                stdio: "inherit"
            });

            const exitCode = await new Promise((resolve) => {
                target.on("exit", (code, signal) => {
                    if (signal) {
                        resolve(128 + (signal === "SIGINT" ? 2 : 15));
                        return;
                    }
                    resolve(code ?? 0);
                });
            });

            process.exitCode = exitCode;
            if (target.exitCode === null && target.signalCode === null) {
                target.kill("SIGTERM");
            }
        } finally {
            await stopChild(pageServer);
        }
    } catch (error) {
        console.error(error && error.stack ? error.stack : error);
        process.exitCode = 1;
    } finally {
        await stopChild(server);
    }
}

main().catch((error) => {
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
});
