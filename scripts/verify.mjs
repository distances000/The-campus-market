import { spawn } from "node:child_process";

const CHECK_SETS = {
    local: [
        { name: "前端构建", command: "npm run build:client" },
        { name: "后端语法检查", command: "npm run check:server:syntax" },
        { name: "环境检查", command: "npm run doctor:env" },
        { name: "数据库检查", command: "npm run doctor:db" },
        { name: "核心回归", command: "npm run smoke:critical" }
    ],
    full: [
        { name: "前端构建", command: "npm run build:client" },
        { name: "后端语法检查", command: "npm run check:server:syntax" },
        { name: "环境检查", command: "npm run doctor:env" },
        { name: "数据库检查", command: "npm run doctor:db" },
        { name: "核心回归", command: "npm run smoke:critical" },
        { name: "并发检查", command: "npm run smoke:concurrency" }
    ]
};

function getRequestedMode(argv) {
    const mode = argv[2] || "full";

    if (!CHECK_SETS[mode]) {
        console.error(`不支持的校验模式: ${mode}`);
        console.error(`可用模式: ${Object.keys(CHECK_SETS).join(", ")}`);
        process.exit(1);
    }

    return mode;
}

function runShellCommand(command) {
    return new Promise((resolve, reject) => {
        const shell = process.platform === "win32" ? "cmd" : "sh";
        const shellArgs = process.platform === "win32"
            ? ["/c", command]
            : ["-lc", command];

        const child = spawn(shell, shellArgs, {
            cwd: process.cwd(),
            stdio: "inherit"
        });

        child.on("error", reject);
        child.on("exit", (code) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error(`命令执行失败: ${command}`));
        });
    });
}

async function main() {
    const mode = getRequestedMode(process.argv);
    const checks = CHECK_SETS[mode];

    console.log(`开始执行 ${mode} 校验，共 ${checks.length} 项。`);

    for (let index = 0; index < checks.length; index += 1) {
        const item = checks[index];
        console.log(`\n[${index + 1}/${checks.length}] ${item.name}`);
        console.log(`执行命令: ${item.command}`);
        await runShellCommand(item.command);
    }

    console.log(`\n${mode} 校验完成，全部通过。`);
}

main().catch((error) => {
    console.error(`\n校验中断: ${error.message}`);
    process.exit(1);
});
