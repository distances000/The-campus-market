const { getDb } = require("../config/db");

function adminMiddleware(req, res, next) {
    if (!req.user?.id) {
        return res.status(401).json({ code: 401, message: "未登录" });
    }

    const db = getDb();
    const user = db.prepare("SELECT id, is_admin FROM users WHERE id=?").get(req.user.id);
    if (!user) {
        return res.status(401).json({ code: 401, message: "用户不存在" });
    }
    if (!user.is_admin) {
        return res.status(403).json({ code: 403, message: "需要管理员权限" });
    }

    req.user.is_admin = true;
    next();
}

module.exports = { adminMiddleware };
