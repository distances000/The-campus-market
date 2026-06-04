const express = require("express");
const { getDb } = require("../config/db");
const { authMiddleware, optionalAuth } = require("../middleware/auth");
const { createNotification } = require("../utils/notifications");
const { normalizeImageList, getRemovedManagedUrls, deleteManagedUploadsIfOrphan } = require("../utils/upload");
const { buildLockName, withNamedLock } = require("../utils/db-lock");
const { getUserFacingMessage, isDuplicateEntryError } = require("../utils/error");
const { logError } = require("../utils/logger");
const {
    ensureOptionalEnum,
    ensureOptionalText,
    ensurePagination,
    ensurePositiveInt,
    ensurePrice,
    ensureRequiredText
} = require("../utils/validate");
const router = express.Router();

const ALLOWED_PRODUCT_CATEGORIES = ["digital", "books", "life", "clothing", "sports", "beauty", "other"];
const ALLOWED_PRODUCT_CONDITIONS = ["brand_new", "like_new", "used", "old"];
const ALLOWED_SORTS = ["latest", "price_asc", "price_desc", "hot"];
const ALLOWED_PRODUCT_STATUSES = ["active", "inactive", "sold"];
const MAX_PRODUCT_TITLE_LENGTH = 80;
const MAX_PRODUCT_DESCRIPTION_LENGTH = 2000;
const MAX_CAMPUS_LENGTH = 50;

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
    let normalizedTitle;
    let normalizedDescription;
    let normalizedCampus;
    let normalizedPrice;
    let normalizedOriginalPrice = null;
    let normalizedCategory;
    let normalizedCondition;

    try {
        normalizedTitle = ensureRequiredText(title, "商品标题", { maxLength: MAX_PRODUCT_TITLE_LENGTH });
        normalizedDescription = ensureOptionalText(description, "商品描述", { maxLength: MAX_PRODUCT_DESCRIPTION_LENGTH });
        normalizedCampus = ensureOptionalText(campus, "校区", { maxLength: MAX_CAMPUS_LENGTH });
        normalizedPrice = ensurePrice(price, "售价");
        if (original_price !== undefined && original_price !== null && String(original_price).trim() !== "") {
            normalizedOriginalPrice = ensurePrice(original_price, "原价");
        }
        normalizedCategory = ensureOptionalEnum(category, ALLOWED_PRODUCT_CATEGORIES, "商品分类", { defaultValue: "other" });
        normalizedCondition = ensureOptionalEnum(condition, ALLOWED_PRODUCT_CONDITIONS, "成色", { defaultValue: "used" });
    } catch (error) {
        return res.json({ code: 400, message: getUserFacingMessage(error, "商品信息填写不完整") });
    }

    let images = [];
    try {
        images = normalizeImageList(images_json || "[]");
    } catch (error) {
        return res.json({ code: 400, message: getUserFacingMessage(error, "商品图片格式不正确") });
    }
    const db = getDb();
    let r;
    try {
        await db.transaction(async (tx) => {
            await withNamedLock(tx, buildLockName("product-create", req.user.id, normalizedTitle, normalizedPrice), async () => {
                const duplicatedProduct = await tx.prepare(`
                    SELECT id
                    FROM products
                    WHERE seller_id=? AND title=? AND price=? AND created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 10 SECOND)
                    LIMIT 1
                `).get(req.user.id, normalizedTitle, normalizedPrice);
                if (duplicatedProduct) {
                    throw new Error("DUPLICATE_PRODUCT");
                }

                r = await tx.prepare("INSERT INTO products (seller_id,title,description,price,original_price,category,`condition`,campus,images_json) VALUES (?,?,?,?,?,?,?,?,?)")
                    .run(req.user.id, normalizedTitle, normalizedDescription, normalizedPrice, normalizedOriginalPrice, normalizedCategory, normalizedCondition, normalizedCampus, JSON.stringify(images));
            });
        });
    } catch (error) {
        if (error?.message === "DUPLICATE_PRODUCT") {
            return res.json({ code: 400, message: "请勿重复提交相同商品" });
        }
        throw error;
    }
    const p = await db.prepare("SELECT p.*,u.nickname AS seller_name,u.avatar_url AS seller_avatar FROM products p JOIN users u ON p.seller_id=u.id WHERE p.id=?")
        .get(r.lastInsertRowid);
    p.images = JSON.parse(p.images_json); delete p.images_json;
    res.json({ code: 200, message: "商品发布成功", data: p });
});

router.get("/", optionalAuth, async (req, res) => {
    const { category, campus, keyword, sort = "latest", page = 1, page_size = 20 } = req.query;
    const db = getDb();
    const conds = ["p.status='active'"], params = [];
    let pagination;

    try {
        pagination = ensurePagination({ page, page_size }, { defaultPageSize: 20, maxPageSize: 50 });
        ensureOptionalEnum(sort, ALLOWED_SORTS, "排序方式", { defaultValue: "latest" });
        if (category && category !== "all") {
            ensureOptionalEnum(category, ALLOWED_PRODUCT_CATEGORIES, "商品分类", { defaultValue: "all" });
        }
    } catch (error) {
        return res.json({ code: 400, message: getUserFacingMessage(error, "商品列表查询参数不合法") });
    }

    if (category && category !== "all") { conds.push("p.category=?"); params.push(category); }
    if (campus && campus !== "all") { conds.push("p.campus=?"); params.push(campus); }
    if (keyword) { conds.push("(p.title LIKE ? OR p.description LIKE ?)"); params.push("%" + keyword + "%", "%" + keyword + "%"); }
    const where = "WHERE " + conds.join(" AND ");
    let order = "ORDER BY p.created_at DESC";
    if (sort === "price_asc") order = "ORDER BY p.price ASC";
    else if (sort === "price_desc") order = "ORDER BY p.price DESC";
    else if (sort === "hot") order = "ORDER BY p.views DESC";
    const { page: pg, pageSize: ps, offset } = pagination;
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
    let pagination;

    try {
        pagination = ensurePagination({ page, page_size }, { defaultPageSize: 20, maxPageSize: 50 });
        const normalizedStatus = ensureOptionalEnum(status, ALLOWED_PRODUCT_STATUSES, "商品状态", { defaultValue: "" });
        if (normalizedStatus) {
            conds.push("p.status=?");
            params.push(normalizedStatus);
        }
    } catch (error) {
        return res.json({ code: 400, message: getUserFacingMessage(error, "我的商品查询参数不合法") });
    }

    const { page: pg, pageSize: ps, offset } = pagination;
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
    let pagination;

    try {
        pagination = ensurePagination({ page, page_size }, { defaultPageSize: 20, maxPageSize: 50 });
        const normalizedStatus = ensureOptionalEnum(status, ALLOWED_PRODUCT_STATUSES, "商品状态", { defaultValue: "" });
        if (normalizedStatus) {
            conds.push("p.status=?");
            params.push(normalizedStatus);
        }
    } catch (error) {
        return res.json({ code: 400, message: getUserFacingMessage(error, "收藏列表查询参数不合法") });
    }

    const { page: pg, pageSize: ps, offset } = pagination;
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
    let productId;

    try {
        productId = ensurePositiveInt(req.params.id, "商品ID");
    } catch (error) {
        return res.json({ code: 400, message: getUserFacingMessage(error, "商品ID不合法") });
    }

    const p = await db.prepare("SELECT p.*,u.nickname AS seller_name,u.avatar_url AS seller_avatar,u.campus AS seller_campus FROM products p JOIN users u ON p.seller_id=u.id WHERE p.id=?")
        .get(productId);
    if (!p) return res.json({ code: 404, message: "商品不存在或已删除" });
    await db.prepare("UPDATE products SET views=views+1 WHERE id=?").run(productId);
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
    let productId;

    try {
        productId = ensurePositiveInt(req.params.id, "商品ID");
    } catch (error) {
        return res.json({ code: 400, message: getUserFacingMessage(error, "商品ID不合法") });
    }

    const current = await db.prepare("SELECT id, status, images_json FROM products WHERE id=? AND seller_id=?").get(productId, req.user.id);
    if (!current)
        return res.json({ code: 403, message: "无权修改该商品" });
    const { title, description, price, original_price, category, condition, campus, images_json, status } = req.body;
    const fields=[], vals=[];
    let nextImages = null;
    try {
        if (title !== undefined) { fields.push("title=?"); vals.push(ensureRequiredText(title, "商品标题", { maxLength: MAX_PRODUCT_TITLE_LENGTH })); }
        if (description !== undefined) { fields.push("description=?"); vals.push(ensureOptionalText(description, "商品描述", { maxLength: MAX_PRODUCT_DESCRIPTION_LENGTH })); }
        if (price !== undefined) { fields.push("price=?"); vals.push(ensurePrice(price, "售价")); }
        if (original_price !== undefined) {
            const normalizedOriginalPrice = original_price === null || String(original_price).trim() === ""
                ? null
                : ensurePrice(original_price, "原价");
            fields.push("original_price=?");
            vals.push(normalizedOriginalPrice);
        }
        if (campus !== undefined) { fields.push("campus=?"); vals.push(ensureOptionalText(campus, "校区", { maxLength: MAX_CAMPUS_LENGTH })); }
    } catch (error) {
        return res.json({ code: 400, message: getUserFacingMessage(error, "商品信息填写不合法") });
    }
    if (category !== undefined) {
        fields.push("category=?");
        vals.push(ensureOptionalEnum(category, ALLOWED_PRODUCT_CATEGORIES, "商品分类", { defaultValue: "other" }));
    }
    if (condition !== undefined) {
        fields.push("`condition`=?");
        vals.push(ensureOptionalEnum(condition, ALLOWED_PRODUCT_CONDITIONS, "成色", { defaultValue: "used" }));
    }
    if (images_json !== undefined) {
        try {
            nextImages = normalizeImageList(images_json);
        } catch (error) {
            return res.json({ code: 400, message: getUserFacingMessage(error, "商品图片格式不正确") });
        }
        fields.push("images_json=?");
        vals.push(JSON.stringify(nextImages));
    }
    if (status !== undefined) {
        const nextStatus = normalizeStatus(status);
        if (!ALLOWED_PRODUCT_STATUSES.includes(nextStatus)) return res.json({ code: 400, message: "商品状态不合法" });
        if (!canTransitionProductStatus(current.status, nextStatus)) return res.json({ code: 400, message: "当前商品状态不允许这样变更" });
        fields.push("status=?");
        vals.push(nextStatus);
    }
    if (!fields.length) return res.json({ code: 400, message: "没有可更新的商品内容" });
    fields.push("updated_at=CURRENT_TIMESTAMP"); vals.push(productId);
    await db.prepare("UPDATE products SET " + fields.join(",") + " WHERE id=?").run(...vals);
    const p = await db.prepare("SELECT p.*,u.nickname AS seller_name,u.avatar_url AS seller_avatar FROM products p JOIN users u ON p.seller_id=u.id WHERE p.id=?")
        .get(productId);
    p.images = JSON.parse(p.images_json); delete p.images_json;
    if (nextImages) {
        const previousImages = normalizeImageList(current.images_json || "[]");
        try {
            await deleteManagedUploadsIfOrphan(db, getRemovedManagedUrls(previousImages, nextImages));
        } catch (error) {
            logError("product.cleanup_failed", "替换商品图片后清理旧文件失败", error, {
                product_id: productId,
                user_id: req.user.id
            });
        }
    }
    res.json({ code: 200, message: "商品已更新", data: p });
});

router.delete("/:id", authMiddleware, async (req, res) => {
    const db = getDb();
    let productId;

    try {
        productId = ensurePositiveInt(req.params.id, "商品ID");
    } catch (error) {
        return res.json({ code: 400, message: getUserFacingMessage(error, "商品ID不合法") });
    }

    const product = await db.prepare("SELECT id, images_json FROM products WHERE id=? AND seller_id=?").get(productId, req.user.id);
    if (!product)
        return res.json({ code: 403, message: "无权删除该商品" });
    if (await db.prepare("SELECT id FROM orders WHERE product_id=?").get(productId))
        return res.json({ code: 400, message: "该商品已有订单，不能直接删除" });
    await db.prepare("DELETE FROM favorites WHERE product_id=?").run(productId);
    await db.prepare("DELETE FROM products WHERE id=?").run(productId);
    try {
        await deleteManagedUploadsIfOrphan(db, normalizeImageList(product.images_json || "[]"));
    } catch (error) {
        logError("product.cleanup_failed", "删除商品后清理图片失败", error, {
            product_id: productId,
            user_id: req.user.id
        });
    }
    res.json({ code: 200, message: "商品已删除" });
});

router.post("/:id/favorite", authMiddleware, async (req, res) => {
    const db = getDb();
    let productId;

    try {
        productId = ensurePositiveInt(req.params.id, "商品ID");
    } catch (error) {
        return res.json({ code: 400, message: getUserFacingMessage(error, "商品ID不合法") });
    }

    const product = await db.prepare("SELECT id, seller_id, title FROM products WHERE id=?").get(productId);
    if (!product)
        return res.json({ code: 404, message: "商品不存在或已删除" });
    const fav = await db.prepare("SELECT id FROM favorites WHERE user_id=? AND product_id=?").get(req.user.id, productId);
    if (fav) {
        await db.prepare("DELETE FROM favorites WHERE user_id=? AND product_id=?").run(req.user.id, productId);
        res.json({ code: 200, message: "已取消收藏", data: { favorited: false } });
    } else {
        try {
            await db.prepare("INSERT INTO favorites (user_id,product_id) VALUES (?,?)").run(req.user.id, productId);
        } catch (error) {
            if (isDuplicateEntryError(error)) {
                return res.json({ code: 400, message: "请勿重复收藏" });
            }
            throw error;
        }
        await createNotification(db, {
            userId: product.seller_id,
            actorId: req.user.id,
            kind: "interaction",
            eventType: "product_favorited",
            title: "有人收藏了你的商品",
            content: product.title,
            objectType: "product",
            objectId: productId
        });
        res.json({ code: 200, message: "收藏成功", data: { favorited: true } });
    }
});

module.exports = router;
