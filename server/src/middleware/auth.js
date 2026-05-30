const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "campus-market-secret-key-2026";

function generateToken(user) {
    return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
}

function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ code: 401, message: "????" });
    }
    const token = authHeader.split(" ")[1];
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (err) {
        return res.status(401).json({ code: 401, message: "?????" });
    }
}

function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
        try { req.user = jwt.verify(authHeader.split(" ")[1], JWT_SECRET); } catch (err) {}
    }
    next();
}

module.exports = { generateToken, authMiddleware, optionalAuth, JWT_SECRET };
