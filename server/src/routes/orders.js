const express = require("express");
const { getDb } = require("../config/db");
const { authMiddleware } = require("../middleware/auth");
const { createNotification } = require("../utils/notifications");
const { createAppError, getUserFacingMessage } = require("../utils/error");
const {
    ensureOptionalEnum,
    ensureOptionalText,
    ensurePositiveInt
} = require("../utils/validate");

const router = express.Router();

const ALLOWED_ORDER_ROLES = ["all", "buyer", "seller"];
const ALLOWED_ORDER_STATUSES = ["pending_completion", "completed", "cancelled"];
const MAX_REVIEW_CONTENT_LENGTH = 300;

async function getUserCredit(db, userId) {
    const stats = await db.prepare(`
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

async function getOrderReviewState(db, orderId) {
    const reviews = await db.prepare("SELECT reviewer_id FROM reviews WHERE order_id=?").all(orderId);
    return reviews.map(item => item.reviewer_id);
}

router.post("/", authMiddleware, async (req, res) => {
    let productId;

    try {
        productId = ensurePositiveInt(req.body.product_id, "商品ID");
    } catch (error) {
        return res.json({ code: 400, message: getUserFacingMessage(error, "商品ID不合法") });
    }

    const db = getDb();
    let orderId;
    let product;

    try {
        orderId = await db.transaction(async (tx) => {
            const lockedProduct = await tx.prepare("SELECT * FROM products WHERE id=? FOR UPDATE").get(productId);
            if (!lockedProduct) {
                throw createAppError("商品不存在", { status: 404, code: 404 });
            }
            if (lockedProduct.seller_id === req.user.id) {
                throw createAppError("不能购买自己发布的商品");
            }
            if (lockedProduct.status !== "active") {
                throw createAppError("该商品当前不可下单");
            }

            const activeOrder = await tx.prepare(`
                SELECT id
                FROM orders
                WHERE product_id=? AND status IN ('pending_completion','completed')
                LIMIT 1
                FOR UPDATE
            `).get(productId);
            if (activeOrder) {
                throw createAppError("该商品已有订单");
            }

            const updateResult = await tx.prepare(`
                UPDATE products
                SET status='sold', updated_at=CURRENT_TIMESTAMP
                WHERE id=? AND status='active'
            `).run(productId);
            if (!updateResult.changes) {
                throw createAppError("该商品当前不可下单");
            }

            const orderResult = await tx.prepare(`
                INSERT INTO orders (product_id,buyer_id,seller_id,price_snapshot,status)
                VALUES (?,?,?,?,?)
            `).run(lockedProduct.id, req.user.id, lockedProduct.seller_id, lockedProduct.price, "pending_completion");
            product = lockedProduct;
            return orderResult.lastInsertRowid;
        });
    } catch (error) {
        return res.status(error.status || 400).json({
            code: error.code || error.status || 400,
            message: getUserFacingMessage(error, "下单失败，请稍后再试")
        });
    }

    const order = await db.prepare(`
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

    await createNotification(db, {
        userId: product.seller_id,
        actorId: req.user.id,
        kind: "system",
        eventType: "order_created",
        title: "你收到了新的订单",
        content: product.title,
        objectType: "order",
        objectId: orderId,
        extra: { product_id: product.id }
    });

    res.json({ code: 200, message: "下单成功", data: order });
});

router.get("/my/list", authMiddleware, async (req, res) => {
    const { role = "all", status } = req.query;
    const db = getDb();
    const conds = [];
    const params = [];
    let normalizedRole;
    let normalizedStatus;

    try {
        normalizedRole = ensureOptionalEnum(role, ALLOWED_ORDER_ROLES, "订单角色", { defaultValue: "all" });
        normalizedStatus = ensureOptionalEnum(status, ALLOWED_ORDER_STATUSES, "订单状态", { defaultValue: "" });
    } catch (error) {
        return res.json({ code: 400, message: getUserFacingMessage(error, "订单查询参数不合法") });
    }

    if (normalizedRole === "buyer") {
        conds.push("o.buyer_id=?");
        params.push(req.user.id);
    } else if (normalizedRole === "seller") {
        conds.push("o.seller_id=?");
        params.push(req.user.id);
    } else {
        conds.push("(o.buyer_id=? OR o.seller_id=?)");
        params.push(req.user.id, req.user.id);
    }

    if (normalizedStatus) {
        conds.push("o.status=?");
        params.push(normalizedStatus);
    }

    const where = "WHERE " + conds.join(" AND ");
    const rows = await db.prepare(`
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
    `).all(...params);
    const list = [];
    for (const order of rows) {
        order.images = JSON.parse(order.images_json || "[]");
        delete order.images_json;
        const reviewers = await getOrderReviewState(db, order.id);
        order.has_reviewed = reviewers.includes(req.user.id);
        order.can_review = order.status === "completed" && !order.has_reviewed;
        order.role = order.buyer_id === req.user.id ? "buyer" : "seller";
        list.push(order);
    }

    res.json({ code: 200, data: { list } });
});

router.post("/:id/complete", authMiddleware, async (req, res) => {
    const db = getDb();
    let orderId;

    try {
        orderId = ensurePositiveInt(req.params.id, "订单ID");
    } catch (error) {
        return res.json({ code: 400, message: getUserFacingMessage(error, "订单ID不合法") });
    }

    let order;

    try {
        await db.transaction(async (tx) => {
            order = await tx.prepare("SELECT * FROM orders WHERE id=? FOR UPDATE").get(orderId);
            if (!order) throw createAppError("订单不存在", { status: 404, code: 404 });
            if (order.buyer_id !== req.user.id) throw createAppError("只有买家可以确认完成", { status: 403, code: 403 });
            if (order.status !== "pending_completion") throw createAppError("当前订单状态不可完成");

            await tx.prepare("UPDATE orders SET status='completed', completed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?").run(order.id);
        });
    } catch (error) {
        return res.status(error.status || 400).json({
            code: error.code || error.status || 400,
            message: getUserFacingMessage(error, "订单完成失败，请稍后再试")
        });
    }

    const product = await db.prepare("SELECT title FROM products WHERE id=?").get(order.product_id);
    await createNotification(db, {
        userId: order.seller_id,
        actorId: req.user.id,
        kind: "system",
        eventType: "order_completed",
        title: "买家已确认订单完成",
        content: product?.title || "点击查看订单详情",
        objectType: "order",
        objectId: order.id,
        extra: { product_id: order.product_id }
    });

    res.json({ code: 200, message: "订单已完成" });
});

router.post("/:id/cancel", authMiddleware, async (req, res) => {
    const db = getDb();
    let orderId;

    try {
        orderId = ensurePositiveInt(req.params.id, "订单ID");
    } catch (error) {
        return res.json({ code: 400, message: getUserFacingMessage(error, "订单ID不合法") });
    }

    let order;

    try {
        await db.transaction(async (tx) => {
            order = await tx.prepare("SELECT * FROM orders WHERE id=? FOR UPDATE").get(orderId);
            if (!order) throw createAppError("订单不存在", { status: 404, code: 404 });
            if (order.buyer_id !== req.user.id && order.seller_id !== req.user.id) {
                throw createAppError("无权取消该订单", { status: 403, code: 403 });
            }
            if (order.status !== "pending_completion") {
                throw createAppError("当前订单状态不可取消");
            }

            await tx.prepare("UPDATE orders SET status='cancelled', cancelled_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?").run(order.id);
            await tx.prepare("UPDATE products SET status='active', updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='sold'").run(order.product_id);
        });
    } catch (error) {
        return res.status(error.status || 400).json({
            code: error.code || error.status || 400,
            message: getUserFacingMessage(error, "订单取消失败，请稍后再试")
        });
    }

    const product = await db.prepare("SELECT title FROM products WHERE id=?").get(order.product_id);
    const targetUserId = order.buyer_id === req.user.id ? order.seller_id : order.buyer_id;
    await createNotification(db, {
        userId: targetUserId,
        actorId: req.user.id,
        kind: "system",
        eventType: "order_cancelled",
        title: "订单已被取消",
        content: product?.title || "点击查看订单详情",
        objectType: "order",
        objectId: order.id,
        extra: { product_id: order.product_id }
    });

    res.json({ code: 200, message: "订单已取消" });
});

router.post("/:id/review", authMiddleware, async (req, res) => {
    let orderId;
    let normalizedContent;

    try {
        orderId = ensurePositiveInt(req.params.id, "订单ID");
        normalizedContent = ensureOptionalText(req.body.content, "评价内容", { maxLength: MAX_REVIEW_CONTENT_LENGTH });
    } catch (error) {
        return res.json({ code: 400, message: getUserFacingMessage(error, "评价内容不合法") });
    }

    const score = Number(req.body.rating);
    if (!Number.isInteger(score) || score < 1 || score > 5) return res.json({ code: 400, message: "评分范围必须是 1-5" });

    const db = getDb();
    const order = await db.prepare("SELECT * FROM orders WHERE id=?").get(orderId);
    if (!order) return res.json({ code: 404, message: "订单不存在" });
    if (order.status !== "completed") return res.json({ code: 400, message: "只有已完成订单才能评价" });
    if (order.buyer_id !== req.user.id && order.seller_id !== req.user.id) return res.json({ code: 403, message: "无权评价该订单" });
    const exists = await db.prepare("SELECT id FROM reviews WHERE order_id=? AND reviewer_id=?").get(order.id, req.user.id);
    if (exists) return res.json({ code: 400, message: "你已经评价过该订单" });

    const revieweeId = order.buyer_id === req.user.id ? order.seller_id : order.buyer_id;
    const result = await db.prepare(`
        INSERT INTO reviews (order_id,product_id,reviewer_id,reviewee_id,rating,content)
        VALUES (?,?,?,?,?,?)
    `).run(order.id, order.product_id, req.user.id, revieweeId, score, normalizedContent);

    const review = await db.prepare(`
        SELECT
            r.*,
            reviewer.nickname AS reviewer_name,
            reviewee.nickname AS reviewee_name
        FROM reviews r
        JOIN users reviewer ON reviewer.id=r.reviewer_id
        JOIN users reviewee ON reviewee.id=r.reviewee_id
        WHERE r.id=?
    `).get(result.lastInsertRowid);

    const product = await db.prepare("SELECT title FROM products WHERE id=?").get(order.product_id);
    await createNotification(db, {
        userId: revieweeId,
        actorId: req.user.id,
        kind: "system",
        eventType: "review_received",
        title: "你收到了新的交易评价",
        content: product?.title || "点击查看评价详情",
        objectType: "review",
        objectId: review.id,
        extra: { order_id: order.id, product_id: order.product_id }
    });

    res.json({ code: 200, message: "评价成功", data: review });
});

router.get("/reviews/received", authMiddleware, async (req, res) => {
    const db = getDb();
    const list = await db.prepare(`
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

    res.json({ code: 200, data: { list, credit: await getUserCredit(db, req.user.id) } });
});

module.exports = router;
