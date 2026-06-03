const { loadAppEnv } = require("../config/loadEnv");
const { DEFAULT_JWT_SECRET } = require("../config/runtime");
const { getDb } = require("../config/db");
const jwt = require("jsonwebtoken");

loadAppEnv();

const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;

function isPasswordChangeExemptRoute(req) {
    if (req?.baseUrl !== "/api/auth") {
        return false;
    }

    return ["/me", "/reset-password", "/logout"].includes(req.path);
}

function generateToken(user) {
    return jwt.sign(
        {
            id: user.id,
            username: user.username,
            is_admin: !!user.is_admin,
            can_moderate: !!user.can_moderate
        },
        JWT_SECRET,
        { expiresIn: "7d" }
    );
}

async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ code: 401, message: "未登录" });
    }
    const token = authHeader.split(" ")[1];
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        const db = getDb();
        const user = await db.prepare(`
            SELECT id, username, is_admin, can_moderate, must_change_password
            FROM users
            WHERE id=?
        `).get(payload.id);

        if (!user) {
            return res.status(401).json({ code: 401, message: "用户不存在" });
        }

        req.user = {
            id: user.id,
            username: user.username,
            is_admin: !!user.is_admin,
            can_moderate: !!user.can_moderate,
            must_change_password: !!user.must_change_password
        };

        if (req.user.must_change_password && !isPasswordChangeExemptRoute(req)) {
            return res.status(423).json({
                code: 423,
                message: "当前账号需要先修改密码后才能继续使用其他功能"
            });
        }

        next();
    } catch (err) {
        return res.status(401).json({ code: 401, message: "登录已失效，请重新登录" });
    }
}

function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
        try { req.user = jwt.verify(authHeader.split(" ")[1], JWT_SECRET); } catch (err) {}
    }
    next();
}

function verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
}

module.exports = { generateToken, authMiddleware, optionalAuth, verifyToken, JWT_SECRET };
