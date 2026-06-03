const express = require("express");
const { getDb } = require("../config/db");
const { authMiddleware, generateToken } = require("../middleware/auth");
const { buildLockName, withNamedLock } = require("../utils/db-lock");

const router = express.Router();

function normalizeText(value) {
    return String(value || "").trim();
}

router.post("/bootstrap-admin", authMiddleware, async (req, res) => {
    const bootstrapKey = normalizeText(req.get("x-bootstrap-key") || req.body.bootstrap_key);
    const configuredKey = normalizeText(process.env.ADMIN_BOOTSTRAP_KEY);

    if (!configuredKey || bootstrapKey !== configuredKey) {
        return res.status(403).json({ code: 403, message: "绠＄悊鍛樺垵濮嬪寲瀵嗛挜涓嶆纭?" });
    }

    const db = getDb();
    try {
        await db.transaction(async (tx) => {
            await withNamedLock(tx, buildLockName("bootstrap-admin"), async () => {
                const adminCount = (await tx.prepare("SELECT COUNT(*) AS count FROM users WHERE is_admin=1").get()).count;
                if (adminCount > 0) {
                    throw new Error("ADMIN_ALREADY_EXISTS");
                }

                await tx.prepare(`
                    UPDATE users
                    SET
                        is_admin=1,
                        can_moderate=1,
                        updated_at=CURRENT_TIMESTAMP
                    WHERE id=?
                `).run(req.user.id);
            });
        });
    } catch (error) {
        if (error?.message === "ADMIN_ALREADY_EXISTS") {
            return res.status(403).json({ code: 403, message: "绠＄悊鍛樺凡瀛樺湪锛屼笉鑳介噸澶嶅垵濮嬪寲" });
        }
        throw error;
    }

    const user = await db.prepare(`
        SELECT id, username, nickname, avatar_url, campus, bio, phone, is_admin, can_moderate, must_change_password, created_at
        FROM users
        WHERE id=?
    `).get(req.user.id);

    return res.json({
        code: 200,
        message: "绠＄悊鍛樺垵濮嬪寲鎴愬姛",
        data: {
            user: {
                ...user,
                is_admin: !!user.is_admin,
                can_moderate: !!user.can_moderate
            },
            token: generateToken(user)
        }
    });
});

module.exports = router;
