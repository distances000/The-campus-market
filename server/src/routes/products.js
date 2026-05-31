const express = require("express");
const { getDb } = require("../config/db");
const { authMiddleware, optionalAuth } = require("../middleware/auth");
const { createNotification } = require("../utils/notifications");
const router = express.Router();

function normalizeStatus(status) {
    return typeof status === "string" ? status.trim() : status;
}

function canTransitionProductStatus(currentStatus, nextStatus) {
    if (currentStatus === nextStatus) return false;
    if (currentStatus === "active") return nextStatus === "sold" || nextStatus === "inactive";
    if (currentStatus === "inactive") return nextStatus === "active";
    return false;
}

async function getUserCredit(db, userId) {
    const credit = await db.prepare(`
        SELECT
            COUNT(*) AS review_count,
            ROUND(COALESCE(AVG(rating), 0), 1) AS rating_avg
        FROM reviews
        WHERE reviewee_id=?
    `).get(userId);
    return {
        review_count: credit.review_count || 0,
        rating_avg: Number(credit.rating_avg || 0)
    };
}

router.post("/", authMiddleware, async (req, res) => {
    const { title, description, price, original_price, category, condition, campus, images_json } = req.body;
    if (!title || !price) return res.json({ code: 400, message: "???????????" });
    const db = getDb();
    const r = await db.prepare("INSERT INTO products (seller_id,title,description,price,original_price,category,condition,campus,images_json) VALUES (?,?,?,?,?,?,?,?,?)")
        .run(req.user.id, title, description || "", price, original_price || null, category || "other", condition || "used", campus || "", images_json || "[]");
    const p = await db.prepare("SELECT p.*,u.nickname AS seller_name,u.avatar_url AS seller_avatar FROM products p JOIN users u ON p.seller_id=u.id WHERE p.id=?")
        .get(r.lastInsertRowid);
    p.images = JSON.parse(p.images_json); delete p.images_json;
    res.json({ code: 200, message: "????", data: p });
});

router.get("/", optionalAuth, async (req, res) => {
    const { category, campus, keyword, sort = "latest", page = 1, page_size = 20 } = req.query;
    const db = getDb();
    const conds = ["p.status='active'"], params = [];
    if (category && category !== "all") { conds.push("p.category=?"); params.push(category); }
    if (campus && campus !== "all") { conds.push("p.campus=?"); params.push(campus); }
    if (keyword) { conds.push("(p.title LIKE ? OR p.description LIKE ?)"); params.push("%" + keyword + "%", "%" + keyword + "%"); }
    const where = "WHERE " + conds.join(" AND ");
    let order = "ORDER BY p.created_at DESC";
    if (sort === "price_asc") order = "ORDER BY p.price ASC";
    else if (sort === "price_desc") order = "ORDER BY p.price DESC";
    else if (sort === "hot") order = "ORDER BY p.views DESC";
    const pg = parseInt(page, 10), ps = parseInt(page_size, 10), offset = (pg - 1) * ps;
    const total = (await db.prepare("SELECT COUNT(*) AS count FROM products p " + where).get(...params)).count;
    const rows = await db.prepare("SELECT p.*,u.nickname AS seller_name,u.avatar_url AS seller_avatar FROM products p JOIN users u ON p.seller_id=u.id " + where + " " + order + " LIMIT ? OFFSET ?")
        .all(...params, ps, offset);
    const list = rows.map((product) => {
        product.images = JSON.parse(product.images_json);
        delete product.images_json;
        return product;
    });
    res.json({ code: 200, data: { list, total, page: pg, page_size: ps, total_pages: Math.ceil(total / ps) } });
});

router.get("/my/list", authMiddleware, async (req, res) => {
    const { status, page = 1, page_size = 20 } = req.query;
    const db = getDb();
    const conds = ["p.seller_id=?"], params = [req.user.id];
    if (status) { conds.push("p.status=?"); params.push(status); }
    const pg = parseInt(page, 10), ps = parseInt(page_size, 10), offset = (pg - 1) * ps;
    const total = (await db.prepare("SELECT COUNT(*) AS count FROM products p WHERE " + conds.join(" AND ")).get(...params)).count;
    const rows = await db.prepare("SELECT p.*,u.nickname AS seller_name FROM products p JOIN users u ON p.seller_id=u.id WHERE " + conds.join(" AND ") + " ORDER BY p.created_at DESC LIMIT ? OFFSET ?")
        .all(...params, ps, offset);
    const list = rows.map((product) => { product.images = JSON.parse(product.images_json); delete product.images_json; return product; });
    res.json({ code: 200, data: { list, total, page: pg, page_size: ps } });
});

router.get("/favorites/list", authMiddleware, async (req, res) => {
    const { status, page = 1, page_size = 20 } = req.query;
    const db = getDb();
    const conds = ["f.user_id=?"];
    const params = [req.user.id];
    if (status) { conds.push("p.status=?"); params.push(status); }
    const pg = parseInt(page), ps = parseInt(page_size), offset = (pg - 1) * ps;
    const total = (await db.prepare("SELECT COUNT(*) AS count FROM favorites f JOIN products p ON p.id=f.product_id WHERE " + conds.join(" AND ")).get(...params)).count;
    const rows = await db.prepare(`
        SELECT
            p.*,
            u.nickname AS seller_name,
            u.avatar_url AS seller_avatar,
            f.created_at AS favorited_at
        FROM favorites f
        JOIN products p ON p.id=f.product_id
        JOIN users u ON u.id=p.seller_id
        WHERE ${conds.join(" AND ")}
        ORDER BY f.created_at DESC
        LIMIT ? OFFSET ?
    `).all(...params, ps, offset);
    const list = rows.map((product) => { product.images = JSON.parse(product.images_json); delete product.images_json; return product; });
    res.json({ code: 200, data: { list, total, page: pg, page_size: ps, total_pages: Math.ceil(total / ps) } });
});

router.get("/:id", optionalAuth, async (req, res) => {
    const db = getDb();
    const p = await db.prepare("SELECT p.*,u.nickname AS seller_name,u.avatar_url AS seller_avatar,u.campus AS seller_campus FROM products p JOIN users u ON p.seller_id=u.id WHERE p.id=?")
        .get(req.params.id);
    if (!p) return res.json({ code: 404, message: "?????" });
    await db.prepare("UPDATE products SET views=views+1 WHERE id=?").run(req.params.id);
    p.images = JSON.parse(p.images_json); delete p.images_json;
    let fav = false;
    if (req.user) fav = !!(await db.prepare("SELECT id FROM favorites WHERE user_id=? AND product_id=?").get(req.user.id, p.id));
    const reviews = await db.prepare(`
        SELECT
            r.*,
            reviewer.nickname AS reviewer_name,
            reviewer.avatar_url AS reviewer_avatar
        FROM reviews r
        JOIN users reviewer ON reviewer.id=r.reviewer_id
        WHERE r.product_id=?
        ORDER BY r.created_at DESC
        LIMIT 20
    `).all(p.id);
    const currentOrder = req.user ? await db.prepare(`
        SELECT
            id,
            buyer_id,
            seller_id,
            status,
            created_at,
            completed_at
        FROM orders
        WHERE product_id=?
          AND (buyer_id=? OR seller_id=?)
        ORDER BY created_at DESC
        LIMIT 1
    `).get(p.id, req.user.id, req.user.id) : null;
    res.json({
        code: 200,
        data: {
            ...p,
            is_favorited: fav,
            seller_credit: await getUserCredit(db, p.seller_id),
            reviews,
            current_order: currentOrder || null
        }
    });
});

router.put("/:id", authMiddleware, async (req, res) => {
    const db = getDb();
    if (!await db.prepare("SELECT id FROM products WHERE id=? AND seller_id=?").get(req.params.id, req.user.id))
        return res.json({ code: 403, message: "????" });
    const { title, description, price, original_price, category, condition, campus, images_json, status } = req.body;
    const current = await db.prepare("SELECT status FROM products WHERE id=? AND seller_id=?").get(req.params.id, req.user.id);
    if (!current) return res.json({ code: 403, message: "????" });
    const fields=[], vals=[];
    if (title !== undefined) { fields.push("title=?"); vals.push(title); }
    if (description !== undefined) { fields.push("description=?"); vals.push(description); }
    if (price !== undefined) { fields.push("price=?"); vals.push(price); }
    if (original_price !== undefined) { fields.push("original_price=?"); vals.push(original_price); }
    if (category !== undefined) { fields.push("category=?"); vals.push(category); }
    if (condition !== undefined) { fields.push("condition=?"); vals.push(condition); }
    if (campus !== undefined) { fields.push("campus=?"); vals.push(campus); }
    if (images_json !== undefined) { fields.push("images_json=?"); vals.push(images_json); }
    if (status !== undefined) {
        const nextStatus = normalizeStatus(status);
        if (!canTransitionProductStatus(current.status, nextStatus)) return res.json({ code: 400, message: "??????" });
        fields.push("status=?");
        vals.push(nextStatus);
    }
    if (!fields.length) return res.json({ code: 400, message: "????????" });
    fields.push("updated_at=CURRENT_TIMESTAMP"); vals.push(req.params.id);
    await db.prepare("UPDATE products SET " + fields.join(",") + " WHERE id=?").run(...vals);
    const p = await db.prepare("SELECT p.*,u.nickname AS seller_name,u.avatar_url AS seller_avatar FROM products p JOIN users u ON p.seller_id=u.id WHERE p.id=?")
        .get(req.params.id);
    p.images = JSON.parse(p.images_json); delete p.images_json;
    res.json({ code: 200, message: "????", data: p });
});

router.delete("/:id", authMiddleware, async (req, res) => {
    const db = getDb();
    if (!await db.prepare("SELECT id FROM products WHERE id=? AND seller_id=?").get(req.params.id, req.user.id))
        return res.json({ code: 403, message: "????" });
    if (await db.prepare("SELECT id FROM orders WHERE product_id=?").get(req.params.id))
        return res.json({ code: 400, message: "该商品已有订单，不能直接删除" });
    await db.prepare("DELETE FROM favorites WHERE product_id=?").run(req.params.id);
    await db.prepare("DELETE FROM products WHERE id=?").run(req.params.id);
    res.json({ code: 200, message: "????" });
});

router.post("/:id/favorite", authMiddleware, async (req, res) => {
    const db = getDb();
    const product = await db.prepare("SELECT id, seller_id, title FROM products WHERE id=?").get(req.params.id);
    if (!product)
        return res.json({ code: 404, message: "?????" });
    const fav = await db.prepare("SELECT id FROM favorites WHERE user_id=? AND product_id=?").get(req.user.id, req.params.id);
    if (fav) {
        await db.prepare("DELETE FROM favorites WHERE user_id=? AND product_id=?").run(req.user.id, req.params.id);
        res.json({ code: 200, message: "?????", data: { favorited: false } });
    } else {
        await db.prepare("INSERT INTO favorites (user_id,product_id) VALUES (?,?)").run(req.user.id, req.params.id);
        await createNotification(db, {
            userId: product.seller_id,
            actorId: req.user.id,
            kind: "interaction",
            eventType: "product_favorited",
            title: "有人收藏了你的商品",
            content: product.title,
            objectType: "product",
            objectId: Number(req.params.id)
        });
        res.json({ code: 200, message: "????", data: { favorited: true } });
    }
});

module.exports = router;
