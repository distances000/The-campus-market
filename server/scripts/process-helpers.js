const { spawn } = require("child_process");

function attachPrefixedOutput(child, prefix) {
    if (!child) {
        return child;
    }

    child.stdout?.on("data", (chunk) => {
        process.stdout.write(`[${prefix}] ${chunk}`);
    });

    child.stderr?.on("data", (chunk) => {
        process.stderr.write(`[${prefix}] ${chunk}`);
    });

    return child;
}

function spawnNodeProcess(scriptPath, { cwd, env, label }) {
    const child = spawn(process.execPath, [scriptPath], {
        cwd,
        env,
        stdio: ["ignore", "pipe", "pipe"]
    });

    if (label) {
        attachPrefixedOutput(child, label);
    }

    return child;
}

function waitForChildExit(child) {
    return new Promise((resolve) => {
        child.on("exit", (code, signal) => {
            if (signal) {
                resolve(128 + (signal === "SIGINT" ? 2 : 15));
                return;
            }

            resolve(code ?? 0);
        });
    });
}

function stopChild(child, timeoutMs = 5000) {
    return new Promise((resolve) => {
        if (!child || child.killed || child.exitCode !== null || child.signalCode !== null) {
            resolve();
            return;
        }

        const timer = setTimeout(() => {
            if (!child.killed) {
                child.kill("SIGKILL");
            }
        }, timeoutMs);

        child.once("exit", () => {
            clearTimeout(timer);
            resolve();
        });

        child.kill("SIGTERM");
    });
}

module.exports = {
    attachPrefixedOutput,
    spawnNodeProcess,
    stopChild,
    waitForChildExit
};
