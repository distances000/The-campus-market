import { spawn } from "node:child_process";
import { cwd } from "node:process";

const SERVER_FILES = [
    "server/src/config/db.js",
    "server/src/config/loadEnv.js",
    "server/src/config/runtime.js",
    "server/src/index.js",
    "server/src/middleware/admin.js",
    "server/src/middleware/auth.js",
    "server/src/middleware/moderation.js",
    "server/src/models/init.js",
    "server/src/routes/admin.js",
    "server/src/routes/auth.js",
    "server/src/routes/messages.js",
    "server/src/routes/moderation.js",
    "server/src/routes/orders.js",
    "server/src/routes/posts.js",
    "server/src/routes/products.js",
    "server/src/routes/reports.js",
    "server/src/routes/setup.js",
    "server/src/routes/upload.js",
    "server/src/services/email.js",
    "server/src/utils/db-lock.js",
    "server/src/utils/error.js",
    "server/src/utils/logger.js",
    "server/src/utils/notifications.js",
    "server/src/utils/realtime.js",
    "server/src/utils/upload.js",
    "server/src/utils/validate.js",
    "server/scripts/cleanup-uploads.js",
    "server/scripts/concurrency-check.js",
    "server/scripts/db-doctor.js",
    "server/scripts/doctor-env.js",
    "server/scripts/integration-api.js",
    "server/scripts/repeat-submit-check.js",
    "server/scripts/run-with-server-and-page.js",
    "server/scripts/run-with-server.js",
    "server/scripts/serve-client-dist.js",
    "server/scripts/shared.js",
    "server/scripts/smoke-auth-flow.js",
    "server/scripts/smoke-core-flow.js",
    "server/scripts/smoke-page-access.js",
    "server/scripts/test-helpers.js"
];

function runNodeCheck(filePath) {
    return new Promise((resolve, reject) => {
        const child = spawn("node", ["--check", filePath], {
            cwd: cwd(),
            stdio: "inherit"
        });

        child.on("error", reject);
        child.on("exit", (code) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error(`语法检查失败: ${filePath}`));
        });
    });
}

async function main() {
    console.log(`开始检查后端语法，共 ${SERVER_FILES.length} 个文件。`);

    for (let index = 0; index < SERVER_FILES.length; index += 1) {
        const filePath = SERVER_FILES[index];
        console.log(`[${index + 1}/${SERVER_FILES.length}] ${filePath}`);
        await runNodeCheck(filePath);
    }

    console.log("后端语法检查通过。");
}

main().catch((error) => {
    console.error(`语法检查中断: ${error.message}`);
    process.exit(1);
});
