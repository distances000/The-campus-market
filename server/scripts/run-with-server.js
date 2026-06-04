const path = require("path");
const { waitForApiReady, getApiBase } = require("./shared");
const {
    spawnNodeProcess,
    stopChild,
    waitForChildExit
} = require("./process-helpers");

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

    const server = spawnNodeProcess(path.join(serverDir, "src", "index.js"), {
        cwd: serverDir,
        env: serverEnv,
        label: "server"
    });

    const terminate = async (signalCode) => {
        await stopChild(server);
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

        target = spawnNodeProcess(targetPath, {
            cwd: serverDir,
            env: serverEnv
        });

        process.exitCode = await waitForChildExit(target);
    } catch (error) {
        console.error(error && error.stack ? error.stack : error);
        process.exitCode = 1;
    } finally {
        await stopChild(target);
        await stopChild(server);
    }
}

main().catch((error) => {
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
});
