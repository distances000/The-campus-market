const express = require("express");
const { getDb } = require("../config/db");
const { authMiddleware } = require("../middleware/auth");
const { adminMiddleware } = require("../middleware/admin");

const router = express.Router();

router.use(authMiddleware, adminMiddleware);

router.get("/stats", async (req, res) => {
    const db = getDb();

    const [
        reportTotal,
        reportPending,
        reportReviewing,
        reportResolved,
        reportRejected,
        reportToday,
        userTotal,
        adminTotal,
        moderatorTotal,
        productTotal,
        productActive,
        productInactive,
        productSold,
        postTotal
    ] = await Promise.all([
        db.prepare("SELECT COUNT(*) AS count FROM reports").get(),
        db.prepare("SELECT COUNT(*) AS count FROM reports WHERE status='pending'").get(),
        db.prepare("SELECT COUNT(*) AS count FROM reports WHERE status='reviewing'").get(),
        db.prepare("SELECT COUNT(*) AS count FROM reports WHERE status='resolved'").get(),
        db.prepare("SELECT COUNT(*) AS count FROM reports WHERE status='rejected'").get(),
        db.prepare("SELECT COUNT(*) AS count FROM reports WHERE DATE(created_at)=CURRENT_DATE").get(),
        db.prepare("SELECT COUNT(*) AS count FROM users").get(),
        db.prepare("SELECT COUNT(*) AS count FROM users WHERE is_admin=1").get(),
        db.prepare("SELECT COUNT(*) AS count FROM users WHERE can_moderate=1").get(),
        db.prepare("SELECT COUNT(*) AS count FROM products").get(),
        db.prepare("SELECT COUNT(*) AS count FROM products WHERE status='active'").get(),
        db.prepare("SELECT COUNT(*) AS count FROM products WHERE status='inactive'").get(),
        db.prepare("SELECT COUNT(*) AS count FROM products WHERE status='sold'").get(),
        db.prepare("SELECT COUNT(*) AS count FROM posts").get()
    ]);

    return res.json({
        code: 200,
        data: {
            reports: {
                total: reportTotal.count || 0,
                pending: reportPending.count || 0,
                reviewing: reportReviewing.count || 0,
                resolved: reportResolved.count || 0,
                rejected: reportRejected.count || 0,
                today: reportToday.count || 0
            },
            users: {
                total: userTotal.count || 0,
                admins: adminTotal.count || 0,
                moderators: moderatorTotal.count || 0
            },
            products: {
                total: productTotal.count || 0,
                active: productActive.count || 0,
                inactive: productInactive.count || 0,
                sold: productSold.count || 0
            },
            posts: {
                total: postTotal.count || 0
            }
        }
    });
});

module.exports = router;
