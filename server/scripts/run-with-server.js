const { spawn } = require("child_process");
const path = require("path");
const {
    getApiBase,
    waitForApiReady
} = require("./shared");

async function main() {
    const targetScript = process.argv[2];
    if (!targetScript) {
        throw new Error("请传入要执行的脚本路径");
    }

    const serverDir = path.resolve(__dirname, "..");
    const targetPath = path.resolve(serverDir, targetScript);
    const apiBase = getApiBase();
    const serverEnv = {
        ...process.env,
        PORT: String(apiBase.port),
        SMOKE_API_HOST: apiBase.hostname,
        SMOKE_API_PORT: String(apiBase.port),
        ADMIN_BOOTSTRAP_KEY: process.env.ADMIN_BOOTSTRAP_KEY || "test-bootstrap-key"
    };

    const server = spawn(process.execPath, [path.join(serverDir, "src", "index.js")], {
        cwd: serverDir,
        env: serverEnv,
        stdio: ["ignore", "pipe", "pipe"]
    });

    server.stdout.on("data", (chunk) => {
        process.stdout.write(`[server] ${chunk}`);
    });

    server.stderr.on("data", (chunk) => {
        process.stderr.write(`[server] ${chunk}`);
    });

    const stopServer = () => new Promise((resolve) => {
        if (server.killed || server.exitCode !== null || server.signalCode !== null) {
            resolve();
            return;
        }

        const timer = setTimeout(() => {
            if (!server.killed) {
                server.kill("SIGKILL");
            }
        }, 5000);

        server.once("exit", () => {
            clearTimeout(timer);
            resolve();
        });

        server.kill("SIGTERM");
    });

    const terminate = async (signalCode) => {
        await stopServer();
        process.exit(signalCode);
    };

    process.once("SIGINT", () => {
        void terminate(130);
    });

    process.once("SIGTERM", () => {
        void terminate(143);
    });

    let target;

    try {
        await waitForApiReady({ timeoutMs: 60000, intervalMs: 1000 });

        target = spawn(process.execPath, [targetPath], {
            cwd: serverDir,
            env: serverEnv,
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
    } catch (error) {
        console.error(error && error.stack ? error.stack : error);
        process.exitCode = 1;
    } finally {
        if (target && target.exitCode === null && target.signalCode === null) {
            target.kill("SIGTERM");
        }
        await stopServer();
    }
}

main().catch((error) => {
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
});
