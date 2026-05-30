const express = require("express");
const { getDb } = require("../config/db");
const { authMiddleware, optionalAuth } = require("../middleware/auth");
const router = express.Router();

router.post("/", authMiddleware, (req, res) => {
    const { title, description, price, original_price, category, condition, campus, images_json } = req.body;
    if (!title || !price) return res.json({ code: 400, message: "???????????" });
    const db = getDb();
    const r = db.prepare("INSERT INTO products (seller_id,title,description,price,original_price,category,condition,campus,images_json) VALUES (?,?,?,?,?,?,?,?,?)")
        .run(req.user.id, title, description||"", price, original_price||null, category||"other", condition||"used", campus||"", images_json||"[]");
    const p = db.prepare("SELECT p.*,u.nickname AS seller_name,u.avatar_url AS seller_avatar FROM products p JOIN users u ON p.seller_id=u.id WHERE p.id=?")
        .get(r.lastInsertRowid);
    p.images = JSON.parse(p.images_json); delete p.images_json;
    res.json({ code: 200, message: "????", data: p });
});

router.get("/", optionalAuth, (req, res) => {
    const { category, campus, keyword, sort="latest", page=1, page_size=20 } = req.query;
    const db = getDb();
    const conds = ["p.status='active'"], params = [];
    if (category && category!=="all") { conds.push("p.category=?"); params.push(category); }
    if (campus && campus!=="all") { conds.push("p.campus=?"); params.push(campus); }
    if (keyword) { conds.push("(p.title LIKE ? OR p.description LIKE ?)"); params.push("%"+keyword+"%","%"+keyword+"%"); }
    const where = "WHERE "+conds.join(" AND ");
    let order = "ORDER BY p.created_at DESC";
    if (sort==="price_asc") order="ORDER BY p.price ASC";
    else if (sort==="price_desc") order="ORDER BY p.price DESC";
    else if (sort==="hot") order="ORDER BY p.views DESC";
    const pg = parseInt(page), ps = parseInt(page_size), offset = (pg-1)*ps;
    const total = db.prepare("SELECT COUNT(*) AS count FROM products p "+where).get(...params).count;
    const list = db.prepare("SELECT p.*,u.nickname AS seller_name,u.avatar_url AS seller_avatar FROM products p JOIN users u ON p.seller_id=u.id "+where+" "+order+" LIMIT ? OFFSET ?")
        .all(...params, ps, offset).map(p=>{p.images=JSON.parse(p.images_json);delete p.images_json;return p;});
    res.json({ code: 200, data: { list, total, page: pg, page_size: ps, total_pages: Math.ceil(total/ps) } });
});

router.get("/my/list", authMiddleware, (req, res) => {
    const { status, page=1, page_size=20 } = req.query;
    const db = getDb();
    const conds=["p.seller_id=?"], params=[req.user.id];
    if (status) { conds.push("p.status=?"); params.push(status); }
    const pg=parseInt(page), ps=parseInt(page_size), offset=(pg-1)*ps;
    const total = db.prepare("SELECT COUNT(*) AS count FROM products p WHERE "+conds.join(" AND ")).get(...params).count;
    const list = db.prepare("SELECT p.*,u.nickname AS seller_name FROM products p JOIN users u ON p.seller_id=u.id WHERE "+conds.join(" AND ")+" ORDER BY p.created_at DESC LIMIT ? OFFSET ?")
        .all(...params, ps, offset).map(p=>{p.images=JSON.parse(p.images_json);delete p.images_json;return p;});
    res.json({ code: 200, data: { list, total, page: pg, page_size: ps } });
});

router.get("/:id", optionalAuth, (req, res) => {
    const db = getDb();
    const p = db.prepare("SELECT p.*,u.nickname AS seller_name,u.avatar_url AS seller_avatar,u.campus AS seller_campus FROM products p JOIN users u ON p.seller_id=u.id WHERE p.id=?")
        .get(req.params.id);
    if (!p) return res.json({ code: 404, message: "?????" });
    db.prepare("UPDATE products SET views=views+1 WHERE id=?").run(req.params.id);
    p.images = JSON.parse(p.images_json); delete p.images_json;
    let fav=false;
    if (req.user) fav = !!db.prepare("SELECT id FROM favorites WHERE user_id=? AND product_id=?").get(req.user.id, p.id);
    res.json({ code: 200, data: { ...p, is_favorited: fav } });
});

router.put("/:id", authMiddleware, (req, res) => {
    const db = getDb();
    if (!db.prepare("SELECT id FROM products WHERE id=? AND seller_id=?").get(req.params.id, req.user.id))
        return res.json({ code: 403, message: "????" });
    const { title, description, price, original_price, category, condition, campus, images_json, status } = req.body;
    const fields=[], vals=[];
    if (title !== undefined) { fields.push("title=?"); vals.push(title); }
    if (description !== undefined) { fields.push("description=?"); vals.push(description); }
    if (price !== undefined) { fields.push("price=?"); vals.push(price); }
    if (original_price !== undefined) { fields.push("original_price=?"); vals.push(original_price); }
    if (category !== undefined) { fields.push("category=?"); vals.push(category); }
    if (condition !== undefined) { fields.push("condition=?"); vals.push(condition); }
    if (campus !== undefined) { fields.push("campus=?"); vals.push(campus); }
    if (images_json !== undefined) { fields.push("images_json=?"); vals.push(images_json); }
    if (status !== undefined) { fields.push("status=?"); vals.push(status); }
    if (!fields.length) return res.json({ code: 400, message: "????????" });
    fields.push("updated_at=CURRENT_TIMESTAMP"); vals.push(req.params.id);
    db.prepare("UPDATE products SET "+fields.join(",")+" WHERE id=?").run(...vals);
    const p = db.prepare("SELECT p.*,u.nickname AS seller_name,u.avatar_url AS seller_avatar FROM products p JOIN users u ON p.seller_id=u.id WHERE p.id=?")
        .get(req.params.id);
    p.images = JSON.parse(p.images_json); delete p.images_json;
    res.json({ code: 200, message: "????", data: p });
});

router.delete("/:id", authMiddleware, (req, res) => {
    const db = getDb();
    if (!db.prepare("SELECT id FROM products WHERE id=? AND seller_id=?").get(req.params.id, req.user.id))
        return res.json({ code: 403, message: "????" });
    db.prepare("DELETE FROM favorites WHERE product_id=?").run(req.params.id);
    db.prepare("DELETE FROM products WHERE id=?").run(req.params.id);
    res.json({ code: 200, message: "????" });
});

router.post("/:id/favorite", authMiddleware, (req, res) => {
    const db = getDb();
    if (!db.prepare("SELECT id FROM products WHERE id=?").get(req.params.id))
        return res.json({ code: 404, message: "?????" });
    const fav = db.prepare("SELECT id FROM favorites WHERE user_id=? AND product_id=?").get(req.user.id, req.params.id);
    if (fav) {
        db.prepare("DELETE FROM favorites WHERE user_id=? AND product_id=?").run(req.user.id, req.params.id);
        res.json({ code: 200, message: "?????", data: { favorited: false } });
    } else {
        db.prepare("INSERT INTO favorites (user_id,product_id) VALUES (?,?)").run(req.user.id, req.params.id);
        res.json({ code: 200, message: "????", data: { favorited: true } });
    }
});

module.exports = router;