const { getDb } = require("../config/db");

async function moderationMiddleware(req, res, next) {
    if (!req.user?.id) {
        return res.status(401).json({ code: 401, message: "未登录" });
    }

    const db = getDb();
    const user = await db.prepare("SELECT id, is_admin, can_moderate FROM users WHERE id=?").get(req.user.id);
    if (!user) {
        return res.status(401).json({ code: 401, message: "用户不存在" });
    }
    if (!user.is_admin && !user.can_moderate) {
        return res.status(403).json({ code: 403, message: "需要违规处理权限" });
    }

    req.user.is_admin = !!user.is_admin;
    req.user.can_moderate = !!user.can_moderate;
    next();
}

module.exports = { moderationMiddleware };
