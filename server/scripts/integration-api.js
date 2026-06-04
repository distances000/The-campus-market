const {
    buildJsonRequest,
    waitForApiReady
} = require("./shared");
const {
    assert,
    expectCode,
    cleanupUsers,
    createAdminUser,
    logStep
} = require("./test-helpers");

async function main() {
    await waitForApiReady({ timeoutMs: 30000, intervalMs: 1000 });

    const suffix = Date.now().toString().slice(-6);
    const usernames = [
        `it_seller_${suffix}`,
        `it_buyer_${suffix}`,
        `it_admin_${suffix}`
    ];
    const seller = {
        username: usernames[0],
        nickname: `卖家${suffix}`,
        email: `it_seller_${suffix}@example.com`,
        password: "Seller1234!"
    };
    const buyer = {
        username: usernames[1],
        nickname: `买家${suffix}`,
        email: `it_buyer_${suffix}@example.com`,
        password: "Buyer1234!"
    };
    const admin = {
        username: usernames[2],
        nickname: `管理员${suffix}`,
        email: `it_admin_${suffix}@example.com`,
        password: "Admin1234!"
    };

    try {
        logStep("setup", "清理旧测试用户");
        await cleanupUsers(usernames);

        logStep("auth", "注册、登录和改密");
        let result = await buildJsonRequest("POST", "/api/auth/register", seller);
        expectCode(result, 200, "register seller");
        result = await buildJsonRequest("POST", "/api/auth/register", buyer);
        expectCode(result, 200, "register buyer");

        result = await buildJsonRequest("POST", "/api/auth/login", {
            username: seller.username,
            password: seller.password
        });
        expectCode(result, 200, "login seller");
        const sellerToken = result.data.data.token;

        result = await buildJsonRequest("POST", "/api/auth/reset-password", {
            current_password: seller.password,
            new_password: "Seller5678!"
        }, sellerToken);
        expectCode(result, 200, "seller reset password");

        result = await buildJsonRequest("POST", "/api/auth/login", {
            username: seller.username,
            password: "Seller5678!"
        });
        expectCode(result, 200, "login seller after reset");
        const sellerResetToken = result.data.data.token;
        const sellerUserId = result.data.data.user.id;

        logStep("product", "商品发布/改商品/收藏");
        result = await buildJsonRequest("POST", "/api/products", {
            title: "集成测试商品",
            description: "用于验证商品路由",
            price: 88,
            original_price: 99,
            category: "other",
            condition: "used",
            campus: "main",
            images_json: "[]"
        }, sellerResetToken);
        expectCode(result, 200, "create product");
        const productId = result.data.data.id;

        result = await buildJsonRequest("PUT", `/api/products/${productId}`, {
            title: "集成测试商品-改",
            description: "用于验证商品修改",
            price: 90,
            original_price: 110,
            category: "other",
            condition: "used",
            campus: "main",
            images_json: "[]"
        }, sellerResetToken);
        expectCode(result, 200, "update product");

        result = await buildJsonRequest("POST", "/api/auth/login", {
            username: buyer.username,
            password: buyer.password
        });
        expectCode(result, 200, "login buyer");
        const buyerToken = result.data.data.token;
        const buyerUserId = result.data.data.user.id;

        result = await buildJsonRequest("POST", `/api/products/${productId}/favorite`, undefined, buyerToken);
        expectCode(result, 200, "favorite product");

        logStep("post", "帖子发布/评论/点赞");
        result = await buildJsonRequest("POST", "/api/posts", {
            content: "集成测试帖子",
            images_json: "[]",
            campus: "main"
        }, sellerResetToken);
        expectCode(result, 200, "create post");
        const postId = result.data.data.id;

        result = await buildJsonRequest("POST", `/api/posts/${postId}/like`, undefined, buyerToken);
        expectCode(result, 200, "like post");

        result = await buildJsonRequest("POST", `/api/posts/${postId}/comment`, {
            content: "集成测试评论"
        }, buyerToken);
        expectCode(result, 200, "comment post");

        logStep("order", "下单/完成/取消/评价");
        const orderProduct = await buildJsonRequest("POST", "/api/products", {
            title: "集成测试订单商品",
            description: "用于验证订单链路",
            price: 128,
            original_price: 188,
            category: "other",
            condition: "used",
            campus: "main",
            images_json: "[]"
        }, sellerResetToken);
        expectCode(orderProduct, 200, "create order product");
        const orderProductId = orderProduct.data.data.id;

        result = await buildJsonRequest("POST", "/api/orders", { product_id: orderProductId }, buyerToken);
        expectCode(result, 200, "create order");
        const orderId = result.data.data.id;

        result = await buildJsonRequest("POST", `/api/orders/${orderId}/cancel`, undefined, buyerToken);
        expectCode(result, 200, "cancel order");

        const completeProduct = await buildJsonRequest("POST", "/api/products", {
            title: "集成测试完成商品",
            description: "用于验证完成和评价",
            price: 168,
            original_price: 228,
            category: "other",
            condition: "used",
            campus: "main",
            images_json: "[]"
        }, sellerResetToken);
        expectCode(completeProduct, 200, "create complete product");
        const completeProductId = completeProduct.data.data.id;

        result = await buildJsonRequest("POST", "/api/orders", { product_id: completeProductId }, buyerToken);
        expectCode(result, 200, "create complete order");
        const completeOrderId = result.data.data.id;

        result = await buildJsonRequest("POST", `/api/orders/${completeOrderId}/complete`, undefined, buyerToken);
        expectCode(result, 200, "complete order");

        result = await buildJsonRequest("POST", `/api/orders/${completeOrderId}/review`, {
            rating: 5,
            content: "买家评价卖家"
        }, buyerToken);
        expectCode(result, 200, "buyer review seller");

        result = await buildJsonRequest("POST", `/api/orders/${completeOrderId}/review`, {
            rating: 5,
            content: "卖家评价买家"
        }, sellerResetToken);
        expectCode(result, 200, "seller review buyer");

        logStep("message", "私信/好友/通知");
        result = await buildJsonRequest("POST", `/api/messages/friends/${sellerUserId}`, undefined, buyerToken);
        expectCode(result, 200, "add friend");

        result = await buildJsonRequest("POST", "/api/messages", {
            receiver_id: sellerUserId,
            content: "集成测试私信"
        }, buyerToken);
        expectCode(result, 200, "send message");

        result = await buildJsonRequest("GET", `/api/messages/conversation/${buyerUserId}`, undefined, sellerResetToken);
        expectCode(result, 200, "get conversation");

        result = await buildJsonRequest("GET", "/api/messages/unread", undefined, sellerResetToken);
        expectCode(result, 200, "check unread");

        result = await buildJsonRequest("POST", "/api/messages/notifications/read", { kind: "interaction" }, sellerResetToken);
        expectCode(result, 200, "read interaction notifications");

        logStep("report", "举报 / 后台处理");
        const reportTarget = await buildJsonRequest("POST", "/api/products", {
            title: "集成测试举报商品",
            description: "用于举报处理测试",
            price: 199,
            category: "other",
            condition: "used",
            campus: "main",
            images_json: "[]"
        }, sellerResetToken);
        expectCode(reportTarget, 200, "create report target");
        const reportTargetId = reportTarget.data.data.id;

        result = await buildJsonRequest("POST", "/api/reports", {
            target_type: "product",
            target_id: reportTargetId,
            reason: "misleading",
            description: "用于验证举报处理"
        }, buyerToken);
        expectCode(result, 200, "create report");
        const reportId = result.data.data.id;

        await createAdminUser(admin);
        result = await buildJsonRequest("POST", "/api/auth/login", {
            username: admin.username,
            password: admin.password
        });
        expectCode(result, 200, "login admin");
        const adminToken = result.data.data.token;

        result = await buildJsonRequest("PATCH", `/api/moderation/reports/${reportId}`, {
            status: "resolved",
            handled_action: "hide_product",
            resolution_note: "已核验，执行下架"
        }, adminToken);
        expectCode(result, 200, "moderate report");

        logStep("reset", "找回密码申请 / 后台处理");
        result = await buildJsonRequest("POST", "/api/auth/forgot-password/request", {
            username: seller.username,
            email: seller.email,
            reason: "用于验证找回密码"
        });
        expectCode(result, 200, "request password reset");
        const resetRequestId = result.data.data.id;

        result = await buildJsonRequest("GET", "/api/moderation/password-resets?page=1&page_size=20", undefined, adminToken);
        expectCode(result, 200, "list password resets");
        assert((result.data.data.list || []).some((item) => Number(item.id) === Number(resetRequestId)), "reset request should appear in moderation list");

        result = await buildJsonRequest("PATCH", `/api/moderation/password-resets/${resetRequestId}`, {
            status: "resolved",
            resolution_note: "已核验账号归属，现已重置临时密码",
            new_password: "TempPass123!"
        }, adminToken);
        expectCode(result, 200, "resolve password reset");

        console.log(JSON.stringify({
            ok: true,
            checked: [
                "auth.js",
                "products.js",
                "posts.js",
                "orders.js",
                "messages.js"
            ]
        }, null, 2));
    } finally {
        await cleanupUsers(usernames);
        logStep("cleanup", "清理集成测试数据");
    }
}

main().catch((error) => {
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
});
