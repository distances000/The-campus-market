const mysql = require("mysql2/promise");
const {
    buildJsonRequest,
    getDatabaseUrl,
    waitForApiReady
} = require("./shared");

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function expectCode(result, expectedCode, step) {
    assert(result && result.data && result.data.code === expectedCode, `${step} failed: ${JSON.stringify(result && result.data)}`);
}

function logStep(step, detail) {
    console.log(`[${step}] ${detail}`);
}

async function queryDb(sql, params = []) {
    const db = await mysql.createConnection(getDatabaseUrl());
    try {
        const [rows] = await db.query(sql, params);
        return rows;
    } finally {
        await db.end();
    }
}

async function promoteUserAsAdmin(username) {
    const db = await mysql.createConnection(getDatabaseUrl());
    try {
        await db.query(`
            UPDATE users
            SET
                is_admin=1,
                can_moderate=1,
                updated_at=CURRENT_TIMESTAMP
            WHERE username=?
        `, [username]);
    } finally {
        await db.end();
    }
}

async function cleanupTestData(usernames) {
    const db = await mysql.createConnection(getDatabaseUrl());
    try {
        const placeholders = usernames.map(() => "?").join(",");
        const [userRows] = await db.query(`SELECT id, username FROM users WHERE username IN (${placeholders})`, usernames);
        const userIds = userRows.map((row) => row.id);
        if (!userIds.length) {
            return;
        }

        const idPlaceholders = userIds.map(() => "?").join(",");

        await db.beginTransaction();
        await db.query(`DELETE FROM notifications WHERE user_id IN (${idPlaceholders}) OR actor_id IN (${idPlaceholders})`, [...userIds, ...userIds]);
        await db.query(`DELETE FROM password_reset_requests WHERE user_id IN (${idPlaceholders}) OR handled_by IN (${idPlaceholders})`, [...userIds, ...userIds]);
        await db.query(`DELETE FROM hidden_conversations WHERE user_id IN (${idPlaceholders}) OR peer_id IN (${idPlaceholders})`, [...userIds, ...userIds]);
        await db.query(`DELETE FROM friends WHERE user_id IN (${idPlaceholders}) OR friend_id IN (${idPlaceholders})`, [...userIds, ...userIds]);
        await db.query(`DELETE FROM favorites WHERE user_id IN (${idPlaceholders})`, userIds);
        await db.query(`DELETE FROM likes WHERE user_id IN (${idPlaceholders})`, userIds);
        await db.query(`DELETE FROM comments WHERE user_id IN (${idPlaceholders})`, userIds);
        await db.query(`DELETE FROM messages WHERE sender_id IN (${idPlaceholders}) OR receiver_id IN (${idPlaceholders})`, [...userIds, ...userIds]);
        await db.query(`DELETE FROM reviews WHERE reviewer_id IN (${idPlaceholders}) OR reviewee_id IN (${idPlaceholders})`, [...userIds, ...userIds]);
        await db.query(`DELETE FROM orders WHERE buyer_id IN (${idPlaceholders}) OR seller_id IN (${idPlaceholders})`, [...userIds, ...userIds]);
        await db.query(`DELETE FROM reports WHERE reporter_id IN (${idPlaceholders}) OR target_owner_id IN (${idPlaceholders}) OR handled_by IN (${idPlaceholders})`, [...userIds, ...userIds, ...userIds]);
        await db.query(`DELETE FROM posts WHERE author_id IN (${idPlaceholders})`, userIds);
        await db.query(`DELETE FROM products WHERE seller_id IN (${idPlaceholders})`, userIds);
        await db.query(`DELETE FROM users WHERE id IN (${idPlaceholders})`, userIds);
        await db.commit();
    } catch (error) {
        await db.rollback();
        throw error;
    } finally {
        await db.end();
    }
}

function buildUsers() {
    const suffix = Date.now().toString().slice(-6);
    return {
        seller: {
            username: `smoke_seller_${suffix}`,
            nickname: `卖家${suffix}`,
            phone: (`138${suffix.padStart(8, "0")}`).slice(0, 11),
            email: `smoke_seller_${suffix}@example.com`,
            password: "Seller1234!"
        },
        buyer: {
            username: `smoke_buyer_${suffix}`,
            nickname: `买家${suffix}`,
            phone: (`139${suffix.padStart(8, "0")}`).slice(0, 11),
            email: `smoke_buyer_${suffix}@example.com`,
            password: "Buyer1234!"
        },
        admin: {
            username: `smoke_admin_${suffix}`,
            nickname: `管理员${suffix}`,
            phone: (`137${suffix.padStart(8, "0")}`).slice(0, 11),
            email: `smoke_admin_${suffix}@example.com`,
            password: "Admin1234!"
        }
    };
}

async function createUser(user) {
    const result = await buildJsonRequest("POST", "/api/auth/register", {
        username: user.username,
        password: user.password,
        nickname: user.nickname,
        email: user.email
    });
    expectCode(result, 200, `register ${user.username}`);
    return result.data.data;
}

async function loginUser(username, password) {
    const result = await buildJsonRequest("POST", "/api/auth/login", { username, password });
    expectCode(result, 200, `login ${username}`);
    return result.data.data;
}

async function expectBusinessCode(method, path, body, token, expectedCode, step) {
    const result = await buildJsonRequest(method, path, body, token);
    assert(result && result.data && result.data.code === expectedCode, `${step} failed: ${JSON.stringify(result && result.data)}`);
    return result;
}

async function expectHttpStatus(method, path, body, token, expectedStatus, step) {
    const result = await buildJsonRequest(method, path, body, token);
    assert(result && result.status === expectedStatus, `${step} failed: expected status ${expectedStatus}, got ${result && result.status}, body=${JSON.stringify(result && result.data)}`);
    return result;
}

async function getNotificationEvents(token, kind) {
    const result = await buildJsonRequest("GET", `/api/messages/notifications?kind=${kind}`, undefined, token);
    expectCode(result, 200, `notifications ${kind}`);
    return result.data.data.list.map((item) => item.event_type);
}

(async () => {
    const users = buildUsers();
    const usernames = Object.values(users).map((item) => item.username);
    const tempPassword = "Temp1234!";
    try {
        await waitForApiReady({ timeoutMs: 30000, intervalMs: 1000 });
        logStep("setup", "cleaning stale smoke data");
        await cleanupTestData(usernames);

        logStep("auth", "registering seller, buyer and admin candidate");
        await createUser(users.seller);
        await createUser(users.buyer);
        await createUser(users.admin);

        const sellerAuth = await loginUser(users.seller.username, users.seller.password);
        const buyerAuth = await loginUser(users.buyer.username, users.buyer.password);
        await promoteUserAsAdmin(users.admin.username);
        const adminToken = (await loginUser(users.admin.username, users.admin.password)).token;
        const failedLogin = await buildJsonRequest("POST", "/api/auth/login", {
            username: users.seller.username,
            password: "wrong-password"
        });
        assert(failedLogin.data.code === 400, "login failure path should reject wrong password");
        logStep("auth", "admin ready");

        logStep("product", "testing publish/edit/down/up/delete");
        let result = await expectHttpStatus("POST", "/api/products", {
            title: "未登录商品",
            description: "应被权限拦截",
            price: 10,
            category: "other",
            condition: "used",
            campus: "main",
            images_json: "[]"
        }, undefined, 401, "guest publish product");

        const productCrud = await buildJsonRequest("POST", "/api/products", {
            title: "冒烟商品-基础流",
            description: "用于验证商品编辑、下架、上架和删除",
            price: 88,
            original_price: 128,
            category: "other",
            condition: "used",
            campus: "main",
            images_json: "[]"
        }, sellerAuth.token);
        expectCode(productCrud, 200, "create product crud");
        const productCrudId = productCrud.data.data.id;

        result = await expectBusinessCode("PUT", `/api/products/${productCrudId}`, {
            title: "越权修改"
        }, buyerAuth.token, 403, "buyer cannot edit seller product");
        result = await expectBusinessCode("DELETE", `/api/products/${productCrudId}`, undefined, buyerAuth.token, 403, "buyer cannot delete seller product");

        result = await buildJsonRequest("PUT", `/api/products/${productCrudId}`, {
            title: "冒烟商品-已编辑",
            price: 66,
            description: "已完成编辑"
        }, sellerAuth.token);
        expectCode(result, 200, "edit product");
        result = await buildJsonRequest("PUT", `/api/products/${productCrudId}`, { status: "inactive" }, sellerAuth.token);
        expectCode(result, 200, "take down product");
        result = await buildJsonRequest("PUT", `/api/products/${productCrudId}`, { status: "active" }, sellerAuth.token);
        expectCode(result, 200, "relist product");
        result = await buildJsonRequest("DELETE", `/api/products/${productCrudId}`, undefined, sellerAuth.token);
        expectCode(result, 200, "delete product");

        logStep("product", "testing favorite and order cancel flow");
        const productCancel = await buildJsonRequest("POST", "/api/products", {
            title: "冒烟商品-取消订单",
            description: "用于验证下单和取消",
            price: 109,
            category: "other",
            condition: "used",
            campus: "main",
            images_json: "[]"
        }, sellerAuth.token);
        expectCode(productCancel, 200, "create cancel product");
        const productCancelId = productCancel.data.data.id;

        result = await buildJsonRequest("POST", `/api/products/${productCancelId}/favorite`, undefined, buyerAuth.token);
        expectCode(result, 200, "favorite product");
        assert(result.data.data.favorited === true, "favorite state should be true");

        result = await buildJsonRequest("POST", `/api/products/${productCancelId}/favorite`, undefined, buyerAuth.token);
        expectCode(result, 200, "unfavorite product");
        assert(result.data.data.favorited === false, "favorite state should be false after unfavorite");

        const cancelOrder = await buildJsonRequest("POST", "/api/orders", { product_id: productCancelId }, buyerAuth.token);
        expectCode(cancelOrder, 200, "create cancel order");
        const cancelOrderId = cancelOrder.data.data.id;

        result = await buildJsonRequest("POST", `/api/orders/${cancelOrderId}/cancel`, undefined, buyerAuth.token);
        expectCode(result, 200, "cancel order");

        const cancelProductDetail = await buildJsonRequest("GET", `/api/products/${productCancelId}`, undefined, sellerAuth.token);
        expectCode(cancelProductDetail, 200, "cancel product detail after cancel");
        assert(cancelProductDetail.data.data.status === "active", "cancelled order should reactivate product");

        logStep("product", "testing complete order and bilateral review flow");
        const productComplete = await buildJsonRequest("POST", "/api/products", {
            title: "冒烟商品-完成订单",
            description: "用于验证完成和评价",
            price: 199,
            category: "other",
            condition: "used",
            campus: "main",
            images_json: "[]"
        }, sellerAuth.token);
        expectCode(productComplete, 200, "create complete product");
        const productCompleteId = productComplete.data.data.id;

        const completeOrder = await buildJsonRequest("POST", "/api/orders", { product_id: productCompleteId }, buyerAuth.token);
        expectCode(completeOrder, 200, "create complete order");
        const completeOrderId = completeOrder.data.data.id;

        result = await expectBusinessCode("POST", `/api/orders/${completeOrderId}/complete`, undefined, sellerAuth.token, 403, "seller cannot complete buyer order");
        result = await buildJsonRequest("POST", `/api/orders/${completeOrderId}/complete`, undefined, buyerAuth.token);
        expectCode(result, 200, "complete order");

        result = await buildJsonRequest("POST", `/api/orders/${completeOrderId}/review`, {
            rating: 5,
            content: "买家确认收货，评价卖家"
        }, buyerAuth.token);
        expectCode(result, 200, "buyer review seller");

        result = await buildJsonRequest("POST", `/api/orders/${completeOrderId}/review`, {
            rating: 5,
            content: "卖家补充评价买家"
        }, sellerAuth.token);
        expectCode(result, 200, "seller review buyer");

        const sellerReceivedReviews = await buildJsonRequest("GET", "/api/orders/reviews/received", undefined, sellerAuth.token);
        expectCode(sellerReceivedReviews, 200, "seller received reviews");
        assert((sellerReceivedReviews.data.data.list || []).some((item) => item.order_id === completeOrderId), "seller should receive review");

        logStep("post", "testing publish/comment/like/delete");
        const postCrud = await buildJsonRequest("POST", "/api/posts", {
            content: "冒烟帖子-基础流",
            images_json: "[]",
            campus: "main"
        }, sellerAuth.token);
        expectCode(postCrud, 200, "create post crud");
        const postCrudId = postCrud.data.data.id;

        result = await expectBusinessCode("DELETE", `/api/posts/${postCrudId}`, undefined, buyerAuth.token, 403, "buyer cannot delete seller post");
        result = await buildJsonRequest("POST", `/api/posts/${postCrudId}/like`, undefined, buyerAuth.token);
        expectCode(result, 200, "like post");
        result = await buildJsonRequest("POST", `/api/posts/${postCrudId}/comment`, { content: "买家评论帖子" }, buyerAuth.token);
        expectCode(result, 200, "comment post");
        result = await buildJsonRequest("DELETE", `/api/posts/${postCrudId}`, undefined, sellerAuth.token);
        expectCode(result, 200, "delete post");

        logStep("message", "testing search friend, add friend, send message, read, delete conversation, remove friend");
        const userSearch = await buildJsonRequest("GET", `/api/messages/users/search?keyword=${encodeURIComponent(users.seller.username)}`, undefined, buyerAuth.token);
        expectCode(userSearch, 200, "search users");
        assert((userSearch.data.data || []).some((item) => item.username === users.seller.username), "seller should appear in user search");

        result = await buildJsonRequest("POST", `/api/messages/friends/${sellerAuth.user.id}`, undefined, buyerAuth.token);
        expectCode(result, 200, "add friend");

        result = await buildJsonRequest("POST", "/api/messages", {
            receiver_id: sellerAuth.user.id,
            content: "这是一条冒烟测试私信"
        }, buyerAuth.token);
        expectCode(result, 200, "send message");

        const unreadBeforeRead = await buildJsonRequest("GET", "/api/messages/unread", undefined, sellerAuth.token);
        expectCode(unreadBeforeRead, 200, "seller unread before read");
        assert(Number(unreadBeforeRead.data.data.chat_unread_count || 0) >= 1, "seller unread chat count should increase");

        const conversation = await buildJsonRequest("GET", `/api/messages/conversation/${buyerAuth.user.id}`, undefined, sellerAuth.token);
        expectCode(conversation, 200, "seller fetch conversation");
        assert((conversation.data.data.list || []).some((item) => item.content === "这是一条冒烟测试私信"), "conversation should contain latest message");

        const unreadAfterRead = await buildJsonRequest("GET", "/api/messages/unread", undefined, sellerAuth.token);
        expectCode(unreadAfterRead, 200, "seller unread after read");
        assert(Number(unreadAfterRead.data.data.chat_unread_count || 0) === 0, "seller unread chat count should clear after reading");

        result = await buildJsonRequest("DELETE", `/api/messages/conversations/${sellerAuth.user.id}`, undefined, buyerAuth.token);
        expectCode(result, 200, "delete recent conversation");
        result = await buildJsonRequest("DELETE", `/api/messages/friends/${sellerAuth.user.id}`, undefined, buyerAuth.token);
        expectCode(result, 200, "remove friend");

        logStep("report", "testing report product hide and report post delete");
        const reportProduct = await buildJsonRequest("POST", "/api/products", {
            title: "冒烟商品-举报下架",
            description: "用于验证管理员处理商品举报",
            price: 77,
            category: "other",
            condition: "used",
            campus: "main",
            images_json: "[]"
        }, sellerAuth.token);
        expectCode(reportProduct, 200, "create reported product");
        const reportProductId = reportProduct.data.data.id;

        const reportPost = await buildJsonRequest("POST", "/api/posts", {
            content: "冒烟帖子-举报删除",
            images_json: "[]",
            campus: "main"
        }, sellerAuth.token);
        expectCode(reportPost, 200, "create reported post");
        const reportPostId = reportPost.data.data.id;

        const createdReportProduct = await buildJsonRequest("POST", "/api/reports", {
            target_type: "product",
            target_id: reportProductId,
            reason: "misleading",
            description: "用于验证管理员下架商品举报链路"
        }, buyerAuth.token);
        expectCode(createdReportProduct, 200, "report product");

        const createdReportPost = await buildJsonRequest("POST", "/api/reports", {
            target_type: "post",
            target_id: reportPostId,
            reason: "abuse",
            description: "用于验证管理员删除帖子举报链路"
        }, buyerAuth.token);
        expectCode(createdReportPost, 200, "report post");

        result = await expectHttpStatus("PATCH", `/api/moderation/reports/${createdReportProduct.data.data.id}`, {
            status: "resolved",
            handled_action: "hide_product",
            resolution_note: "普通用户不应有此权限"
        }, buyerAuth.token, 403, "buyer cannot moderate reports");

        result = await buildJsonRequest("PATCH", `/api/moderation/reports/${createdReportProduct.data.data.id}`, {
            status: "resolved",
            handled_action: "hide_product",
            resolution_note: "已确认问题，商品已下架"
        }, adminToken);
        expectCode(result, 200, "resolve product report");

        result = await buildJsonRequest("PATCH", `/api/moderation/reports/${createdReportPost.data.data.id}`, {
            status: "resolved",
            handled_action: "delete_post",
            resolution_note: "已确认问题，帖子已删除"
        }, adminToken);
        expectCode(result, 200, "resolve post report");

        const hiddenProduct = await buildJsonRequest("GET", `/api/products/${reportProductId}`, undefined, sellerAuth.token);
        expectCode(hiddenProduct, 200, "hidden product detail");
        assert(hiddenProduct.data.data.status === "inactive", "reported product should become inactive");

        const deletedPost = await buildJsonRequest("GET", `/api/posts/${reportPostId}`, undefined, sellerAuth.token);
        assert(deletedPost.data.code === 404, "reported post should be deleted");

        logStep("notification", "verifying interaction and system notifications");
        const sellerInteractionEvents = await getNotificationEvents(sellerAuth.token, "interaction");
        assert(sellerInteractionEvents.includes("product_favorited"), "seller should receive product_favorited notification");
        assert(sellerInteractionEvents.includes("post_liked"), "seller should receive post_liked notification");
        assert(sellerInteractionEvents.includes("post_commented"), "seller should receive post_commented notification");
        assert(sellerInteractionEvents.includes("friend_added"), "seller should receive friend_added notification");

        const sellerSystemEvents = await getNotificationEvents(sellerAuth.token, "system");
        assert(sellerSystemEvents.includes("order_created"), "seller should receive order_created notification");
        assert(sellerSystemEvents.includes("order_cancelled"), "seller should receive order_cancelled notification");
        assert(sellerSystemEvents.includes("order_completed"), "seller should receive order_completed notification");
        assert(sellerSystemEvents.includes("review_received"), "seller should receive review_received notification");

        const buyerSystemEvents = await getNotificationEvents(buyerAuth.token, "system");
        assert(buyerSystemEvents.includes("review_received"), "buyer should receive review_received notification");
        assert(buyerSystemEvents.includes("report_processed"), "buyer should receive report_processed notification");

        result = await buildJsonRequest("POST", "/api/messages/notifications/read", { kind: "system" }, buyerAuth.token);
        expectCode(result, 200, "mark buyer system notifications read");

        logStep("summary", "all core business flows passed");
        console.log(JSON.stringify({
            ok: true,
            users: usernames,
            checked: [
                "注册/登录",
                "商品发布/编辑/下架/删除",
                "帖子发布/评论/点赞/删除",
                "下单/完成/取消/评价",
                "收藏",
                "私信",
                "好友",
                "举报",
                "通知",
                "权限拦截"
            ]
        }, null, 2));
    } finally {
        await cleanupTestData(usernames);
        logStep("cleanup", "smoke test data removed");
    }
})().catch((error) => {
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
});


