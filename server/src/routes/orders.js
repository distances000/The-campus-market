const express = require("express");
const { getDb } = require("../config/db");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

function getUserCredit(db, userId) {
    const stats = db.prepare(`
        SELECT
            COUNT(*) AS review_count,
            ROUND(COALESCE(AVG(rating), 0), 1) AS rating_avg
        FROM reviews
        WHERE reviewee_id=?
    `).get(userId);
    return {
        review_count: stats.review_count || 0,
        rating_avg: Number(stats.rating_avg || 0)
    };
}

function getOrderReviewState(db, orderId) {
    const reviews = db.prepare("SELECT reviewer_id FROM reviews WHERE order_id=?").all(orderId);
    return reviews.map(item => item.reviewer_id);
}

router.post("/", authMiddleware, (req, res) => {
    const { product_id } = req.body;
    const db = getDb();
    const product = db.prepare("SELECT * FROM products WHERE id=?").get(product_id);
    if (!product) return res.json({ code: 404, message: "商品不存在" });
    if (product.seller_id === req.user.id) return res.json({ code: 400, message: "不能购买自己发布的商品" });
    if (product.status !== "active") return res.json({ code: 400, message: "该商品当前不可下单" });
    const activeOrder = db.prepare("SELECT id FROM orders WHERE product_id=? AND status IN ('pending_completion','completed')").get(product_id);
    if (activeOrder) return res.json({ code: 400, message: "该商品已有订单" });

    const createOrder = db.transaction(() => {
        const orderResult = db.prepare(`
            INSERT INTO orders (product_id,buyer_id,seller_id,price_snapshot,status)
            VALUES (?,?,?,?,?)
        `).run(product.id, req.user.id, product.seller_id, product.price, "pending_completion");
        db.prepare("UPDATE products SET status='sold', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(product.id);
        return orderResult.lastInsertRowid;
    });

    const orderId = createOrder();
    const order = db.prepare(`
        SELECT
            o.*,
            p.title AS product_title,
            p.images_json,
            buyer.nickname AS buyer_name,
            seller.nickname AS seller_name
        FROM orders o
        JOIN products p ON p.id=o.product_id
        JOIN users buyer ON buyer.id=o.buyer_id
        JOIN users seller ON seller.id=o.seller_id
        WHERE o.id=?
    `).get(orderId);
    order.images = JSON.parse(order.images_json || "[]");
    delete order.images_json;
    res.json({ code: 200, message: "下单成功", data: order });
});

router.get("/my/list", authMiddleware, (req, res) => {
    const { role = "all", status } = req.query;
    const db = getDb();
    const conds = [];
    const params = [];
    if (role === "buyer") {
        conds.push("o.buyer_id=?");
        params.push(req.user.id);
    } else if (role === "seller") {
        conds.push("o.seller_id=?");
        params.push(req.user.id);
    } else {
        conds.push("(o.buyer_id=? OR o.seller_id=?)");
        params.push(req.user.id, req.user.id);
    }
    if (status) {
        conds.push("o.status=?");
        params.push(status);
    }
    const where = "WHERE " + conds.join(" AND ");
    const list = db.prepare(`
        SELECT
            o.*,
            p.title AS product_title,
            p.status AS product_status,
            p.images_json,
            buyer.nickname AS buyer_name,
            seller.nickname AS seller_name,
            buyer.id AS buyer_user_id,
            seller.id AS seller_user_id
        FROM orders o
        JOIN products p ON p.id=o.product_id
        JOIN users buyer ON buyer.id=o.buyer_id
        JOIN users seller ON seller.id=o.seller_id
        ${where}
        ORDER BY o.created_at DESC
    `).all(...params).map(order => {
        order.images = JSON.parse(order.images_json || "[]");
        delete order.images_json;
        const reviewers = getOrderReviewState(db, order.id);
        order.has_reviewed = reviewers.includes(req.user.id);
        order.can_review = order.status === "completed" && !order.has_reviewed;
        order.role = order.buyer_id === req.user.id ? "buyer" : "seller";
        return order;
    });
    res.json({ code: 200, data: { list } });
});

router.post("/:id/complete", authMiddleware, (req, res) => {
    const db = getDb();
    const order = db.prepare("SELECT * FROM orders WHERE id=?").get(req.params.id);
    if (!order) return res.json({ code: 404, message: "订单不存在" });
    if (order.buyer_id !== req.user.id) return res.json({ code: 403, message: "只有买家可以确认完成" });
    if (order.status !== "pending_completion") return res.json({ code: 400, message: "当前订单状态不可完成" });
    db.prepare("UPDATE orders SET status='completed', completed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?").run(order.id);
    res.json({ code: 200, message: "订单已完成" });
});

router.post("/:id/cancel", authMiddleware, (req, res) => {
    const db = getDb();
    const order = db.prepare("SELECT * FROM orders WHERE id=?").get(req.params.id);
    if (!order) return res.json({ code: 404, message: "订单不存在" });
    if (order.buyer_id !== req.user.id && order.seller_id !== req.user.id) return res.json({ code: 403, message: "无权取消该订单" });
    if (order.status !== "pending_completion") return res.json({ code: 400, message: "当前订单状态不可取消" });
    const cancelOrder = db.transaction(() => {
        db.prepare("UPDATE orders SET status='cancelled', cancelled_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?").run(order.id);
        db.prepare("UPDATE products SET status='active', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(order.product_id);
    });
    cancelOrder();
    res.json({ code: 200, message: "订单已取消" });
});

router.post("/:id/review", authMiddleware, (req, res) => {
    const { rating, content = "" } = req.body;
    const score = Number(rating);
    if (!Number.isInteger(score) || score < 1 || score > 5) return res.json({ code: 400, message: "评分范围必须为 1-5" });
    const db = getDb();
    const order = db.prepare("SELECT * FROM orders WHERE id=?").get(req.params.id);
    if (!order) return res.json({ code: 404, message: "订单不存在" });
    if (order.status !== "completed") return res.json({ code: 400, message: "只有已完成订单才能评价" });
    if (order.buyer_id !== req.user.id && order.seller_id !== req.user.id) return res.json({ code: 403, message: "无权评价该订单" });
    const exists = db.prepare("SELECT id FROM reviews WHERE order_id=? AND reviewer_id=?").get(order.id, req.user.id);
    if (exists) return res.json({ code: 400, message: "你已经评价过该订单" });
    const revieweeId = order.buyer_id === req.user.id ? order.seller_id : order.buyer_id;
    const result = db.prepare(`
        INSERT INTO reviews (order_id,product_id,reviewer_id,reviewee_id,rating,content)
        VALUES (?,?,?,?,?,?)
    `).run(order.id, order.product_id, req.user.id, revieweeId, score, content.trim());
    const review = db.prepare(`
        SELECT
            r.*,
            reviewer.nickname AS reviewer_name,
            reviewee.nickname AS reviewee_name
        FROM reviews r
        JOIN users reviewer ON reviewer.id=r.reviewer_id
        JOIN users reviewee ON reviewee.id=r.reviewee_id
        WHERE r.id=?
    `).get(result.lastInsertRowid);
    res.json({ code: 200, message: "评价成功", data: review });
});

router.get("/reviews/received", authMiddleware, (req, res) => {
    const db = getDb();
    const list = db.prepare(`
        SELECT
            r.*,
            reviewer.nickname AS reviewer_name,
            reviewer.avatar_url AS reviewer_avatar,
            p.title AS product_title
        FROM reviews r
        JOIN users reviewer ON reviewer.id=r.reviewer_id
        JOIN products p ON p.id=r.product_id
        WHERE r.reviewee_id=?
        ORDER BY r.created_at DESC
    `).all(req.user.id);
    res.json({ code: 200, data: { list, credit: getUserCredit(db, req.user.id) } });
});

module.exports = router;
