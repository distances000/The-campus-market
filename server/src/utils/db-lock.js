const crypto = require("crypto");
const { createAppError } = require("./error");

function buildLockName(prefix, ...parts) {
    const hash = crypto.createHash("sha1").update(parts.map((part) => String(part ?? "")).join("\u0000")).digest("hex");
    return `${prefix}:${hash}`;
}

async function withNamedLock(tx, lockName, callback, timeoutSeconds = 5) {
    const lock = await tx.prepare("SELECT GET_LOCK(?, ?) AS locked").get(lockName, timeoutSeconds);
    if (!lock || Number(lock.locked) !== 1) {
        throw createAppError("系统繁忙，请稍后重试", { status: 429, code: 429 });
    }

    try {
        return await callback();
    } finally {
        try {
            await tx.prepare("SELECT RELEASE_LOCK(?) AS released").get(lockName);
        } catch {
            // 连接释放后锁会自动回收，这里不影响主流程。
        }
    }
}

module.exports = {
    buildLockName,
    withNamedLock
};
