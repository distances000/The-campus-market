const fs = require("fs");
const path = require("path");
const http = require("http");
const mysql = require("../server/node_modules/mysql2/promise");

const FRONTEND_URL = "http://127.0.0.1:5173";
const API_BASE_URL = "http://127.0.0.1:3000";
const CDP_HTTP_URL = "http://127.0.0.1:9222";
const DATABASE_URL = process.env.DATABASE_URL || "mysql://root:czh814814@127.0.0.1:3306/campus_market";
const OUTPUT_DIR = path.join(__dirname, "browser-verify-output");

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function logStep(step, detail) {
    console.log(`[${step}] ${detail}`);
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function httpJson(method, urlPath, body, token) {
    return new Promise((resolve, reject) => {
        const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
        const req = http.request({
            hostname: "127.0.0.1",
            port: 3000,
            path: urlPath,
            method,
            headers: {
                "Content-Type": "application/json",
                ...(payload ? { "Content-Length": payload.length } : {}),
                ...(token ? { Authorization: `Bearer ${token}` } : {})
            }
        }, (res) => {
            let raw = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => {
                raw += chunk;
            });
            res.on("end", () => {
                try {
                    resolve({
                        status: res.statusCode,
                        data: raw ? JSON.parse(raw) : {}
                    });
                } catch (error) {
                    reject(new Error(`解析响应失败 ${method} ${urlPath}: ${raw}`));
                }
            });
        });
        req.on("error", reject);
        if (payload) {
            req.write(payload);
        }
        req.end();
    });
}

async function cleanupTestData(usernames) {
    const db = await mysql.createConnection(DATABASE_URL);
    try {
        const placeholders = usernames.map(() => "?").join(",");
        const [userRows] = await db.query(`SELECT id FROM users WHERE username IN (${placeholders})`, usernames);
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
            username: `browser_seller_${suffix}`,
            nickname: `卖家${suffix}`,
            email: `browser_seller_${suffix}@example.com`,
            password: "Seller1234!"
        },
        buyer: {
            username: `browser_buyer_${suffix}`,
            nickname: `买家${suffix}`,
            email: `browser_buyer_${suffix}@example.com`,
            password: "Buyer1234!"
        },
        admin: {
            username: `browser_admin_${suffix}`,
            nickname: `管理${suffix}`,
            email: `browser_admin_${suffix}@example.com`,
            password: "Admin1234!"
        }
    };
}

async function createUser(user) {
    const result = await httpJson("POST", "/api/auth/register", user);
    assert(result.data.code === 200, `注册失败: ${user.username} => ${JSON.stringify(result.data)}`);
}

async function loginUser(user) {
    const result = await httpJson("POST", "/api/auth/login", {
        username: user.username,
        password: user.password
    });
    assert(result.data.code === 200, `登录失败: ${user.username} => ${JSON.stringify(result.data)}`);
    return result.data.data;
}

async function promoteAdmin(username) {
    const db = await mysql.createConnection(DATABASE_URL);
    try {
        await db.query(`
            UPDATE users
            SET is_admin=1, can_moderate=1, updated_at=CURRENT_TIMESTAMP
            WHERE username=?
        `, [username]);
    } finally {
        await db.end();
    }
}

async function getFirstPageWsUrl() {
    const response = await fetch(`${CDP_HTTP_URL}/json/list`);
    const pages = await response.json();
    assert(Array.isArray(pages) && pages.length > 0, "未找到 Chrome 调试页面");
    return pages[0].webSocketDebuggerUrl;
}

class CdpClient {
    constructor(wsUrl) {
        this.wsUrl = wsUrl;
        this.nextId = 1;
        this.pending = new Map();
        this.eventWaiters = [];
    }

    async connect() {
        logStep("cdp", `连接 ${this.wsUrl}`);
        this.ws = new WebSocket(this.wsUrl);
        await new Promise((resolve, reject) => {
            this.ws.addEventListener("open", resolve, { once: true });
            this.ws.addEventListener("error", reject, { once: true });
        });
        this.ws.addEventListener("error", (event) => {
            console.error("[cdp-error]", event && (event.message || event.type || event));
        });
        this.ws.addEventListener("close", (event) => {
            console.error("[cdp-close]", event.code, event.reason || "");
        });
        this.ws.addEventListener("message", (event) => {
            const message = JSON.parse(String(event.data));
            if (message.id) {
                const pending = this.pending.get(message.id);
                if (!pending) {
                    return;
                }
                this.pending.delete(message.id);
                if (message.error) {
                    pending.reject(new Error(`${message.error.message} (${pending.method})`));
                    return;
                }
                pending.resolve(message.result);
                return;
            }

            this.eventWaiters = this.eventWaiters.filter((waiter) => {
                if (waiter.method !== message.method) {
                    return true;
                }
                if (waiter.predicate && !waiter.predicate(message.params || {})) {
                    return true;
                }
                waiter.resolve(message.params || {});
                return false;
            });
        });
        await this.send("Page.enable");
        await this.send("Runtime.enable");
        await this.send("DOM.enable");
        await this.send("Network.enable");
    }

    close() {
        if (this.ws) {
            this.ws.close();
        }
    }

    send(method, params = {}) {
        const id = this.nextId++;
        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject, method });
            this.ws.send(JSON.stringify({ id, method, params }));
        });
    }

    waitForEvent(method, predicate, timeoutMs = 15000) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.eventWaiters = this.eventWaiters.filter((item) => item.resolve !== wrappedResolve);
                reject(new Error(`等待事件超时: ${method}`));
            }, timeoutMs);
            const wrappedResolve = (params) => {
                clearTimeout(timer);
                resolve(params);
            };
            this.eventWaiters.push({ method, predicate, resolve: wrappedResolve });
        });
    }

    async navigate(url) {
        const loaded = this.waitForEvent("Page.loadEventFired");
        await this.send("Page.navigate", { url });
        await loaded;
        await sleep(800);
    }

    async evaluate(expression) {
        const result = await this.send("Runtime.evaluate", {
            expression,
            awaitPromise: true,
            returnByValue: true
        });
        if (result.exceptionDetails) {
            throw new Error(`页面脚本执行失败: ${result.exceptionDetails.text || "未知异常"}`);
        }
        return result.result ? result.result.value : undefined;
    }

    async waitForFunction(expression, timeoutMs = 10000) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const value = await this.evaluate(expression);
            if (value) {
                return value;
            }
            await sleep(200);
        }
        throw new Error(`等待页面条件超时: ${expression}`);
    }

    async setViewport({ width, height, mobile }) {
        await this.send("Emulation.setDeviceMetricsOverride", {
            width,
            height,
            deviceScaleFactor: mobile ? 3 : 1,
            mobile,
            screenWidth: width,
            screenHeight: height
        });
        if (mobile) {
            await this.send("Emulation.setUserAgentOverride", {
                userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
            });
        } else {
            await this.send("Emulation.setUserAgentOverride", {
                userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"
            });
        }
        await sleep(300);
    }

    async screenshot(fileName) {
        const result = await this.send("Page.captureScreenshot", {
            format: "png",
            fromSurface: true
        });
        const outputPath = path.join(OUTPUT_DIR, fileName);
        fs.writeFileSync(outputPath, Buffer.from(result.data, "base64"));
        return outputPath;
    }
}

function quote(value) {
    return JSON.stringify(value);
}

async function setInputValue(cdp, selector, value) {
    const expression = `
        (() => {
            const input = document.querySelector(${quote(selector)});
            if (!input) return false;
            input.focus();
            input.value = ${quote(value)};
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
            return true;
        })()
    `;
    const ok = await cdp.evaluate(expression);
    assert(ok, `未找到输入框: ${selector}`);
}

async function clickSelector(cdp, selector) {
    const expression = `
        (() => {
            const element = document.querySelector(${quote(selector)});
            if (!element) return false;
            element.click();
            return true;
        })()
    `;
    const ok = await cdp.evaluate(expression);
    assert(ok, `未找到元素: ${selector}`);
}

async function clickButtonByText(cdp, text) {
    const expression = `
        (() => {
            const buttons = Array.from(document.querySelectorAll("button, a"));
            const target = buttons.find((item) => (item.innerText || "").trim().includes(${quote(text)}));
            if (!target) return false;
            target.click();
            return true;
        })()
    `;
    const ok = await cdp.evaluate(expression);
    assert(ok, `未找到按钮文本: ${text}`);
}

async function setAuthStorage(cdp, authData) {
    await cdp.evaluate(`
        (() => {
            localStorage.setItem("cm-user", JSON.stringify({
                token: ${quote(authData.token)},
                user: ${JSON.stringify(authData.user)}
            }));
            return true;
        })()
    `);
}

async function clearAuthStorage(cdp) {
    await cdp.evaluate(`
        (() => {
            localStorage.removeItem("cm-user");
            return true;
        })()
    `);
}

async function registerThroughUi(cdp, user) {
    await cdp.navigate(`${FRONTEND_URL}/register`);
    await cdp.waitForFunction(`document.querySelectorAll(".auth-card input").length >= 5`);
    await cdp.evaluate(`
        (() => {
            const inputs = Array.from(document.querySelectorAll('.auth-card input'));
            if (inputs.length < 5) return false;
            const values = [
                ${quote(user.username)},
                ${quote(user.nickname)},
                ${quote(user.email)},
                ${quote(user.password)},
                ${quote(user.password)}
            ];
            inputs.forEach((input, index) => {
                input.focus();
                input.value = values[index];
                input.dispatchEvent(new Event("input", { bubbles: true }));
                input.dispatchEvent(new Event("change", { bubbles: true }));
            });
            return true;
        })()
    `);
    await clickSelector(cdp, '.auth-card button[type="submit"]');
    await cdp.waitForFunction(`location.pathname === "/home"`, 15000);
}

async function loginThroughUi(cdp, user) {
    await cdp.navigate(`${FRONTEND_URL}/login`);
    await cdp.waitForFunction(`document.querySelectorAll(".auth-card input").length >= 2`);
    await cdp.evaluate(`
        (() => {
            const inputs = Array.from(document.querySelectorAll('.auth-card input'));
            if (inputs.length < 2) return false;
            const values = [${quote(user.username)}, ${quote(user.password)}];
            inputs.forEach((input, index) => {
                input.focus();
                input.value = values[index];
                input.dispatchEvent(new Event("input", { bubbles: true }));
                input.dispatchEvent(new Event("change", { bubbles: true }));
            });
            return true;
        })()
    `);
    await clickSelector(cdp, '.auth-card button[type="submit"]');
    await cdp.waitForFunction(`location.pathname === "/home"`, 15000);
}

async function publishThroughUi(cdp, title) {
    await cdp.navigate(`${FRONTEND_URL}/publish`);
    await cdp.waitForFunction(`document.querySelectorAll(".publish-container input").length >= 2`);
    await cdp.evaluate(`
        (() => {
            const inputs = Array.from(document.querySelectorAll(".publish-container input.ui-input"));
            const textarea = document.querySelector(".publish-container textarea");
            if (inputs.length < 2 || !textarea) return false;
            inputs[0].focus();
            inputs[0].value = ${quote(title)};
            inputs[0].dispatchEvent(new Event("input", { bubbles: true }));
            inputs[0].dispatchEvent(new Event("change", { bubbles: true }));
            textarea.focus();
            textarea.value = "桌面端实浏览器验证用商品描述";
            textarea.dispatchEvent(new Event("input", { bubbles: true }));
            textarea.dispatchEvent(new Event("change", { bubbles: true }));
            inputs[1].focus();
            inputs[1].value = "88";
            inputs[1].dispatchEvent(new Event("input", { bubbles: true }));
            inputs[1].dispatchEvent(new Event("change", { bubbles: true }));
            return true;
        })()
    `);
    await clickButtonByText(cdp, "发布商品");
    await cdp.waitForFunction(`location.pathname.startsWith("/product/")`, 15000);
    const productUrl = await cdp.evaluate("location.pathname");
    return Number(productUrl.split("/").pop());
}

async function searchAndOpenChat(cdp, sellerUsername) {
    await cdp.navigate(`${FRONTEND_URL}/messages`);
    await cdp.waitForFunction(`document.querySelector(".search-card input")`);
    await setInputValue(cdp, ".search-card input", sellerUsername);
    await clickButtonByText(cdp, "搜索");
    await cdp.waitForFunction(`document.querySelectorAll(".search-results .list-item").length > 0`, 15000);
    await cdp.evaluate(`
        (() => {
            const button = document.querySelector(".search-results .list-item .user-actions button");
            if (!button) return false;
            button.click();
            return true;
        })()
    `);
    await cdp.waitForFunction(`location.pathname.startsWith("/chat/")`, 15000);
}

async function sendChatMessage(cdp, content) {
    await cdp.waitForFunction(`document.querySelector(".chat-input input")`);
    await setInputValue(cdp, ".chat-input input", content);
    await clickButtonByText(cdp, "发送");
    await cdp.waitForFunction(`document.querySelectorAll(".msg-item").length > 0`, 15000);
}

async function quickResolveReport(cdp) {
    await cdp.navigate(`${FRONTEND_URL}/moderation/reports`);
    await cdp.waitForFunction(`document.querySelectorAll("table tbody tr").length > 0 || document.querySelectorAll(".el-table__row").length > 0`, 15000);
    await cdp.waitForFunction(`document.querySelectorAll(".table-actions button, .table-actions .el-button").length > 1`, 10000);
    const clicked = await cdp.evaluate(`
        (() => {
            const groups = Array.from(document.querySelectorAll(".table-actions"));
            for (const group of groups) {
                const buttons = Array.from(group.querySelectorAll("button"));
                if (buttons.length >= 2) {
                    buttons[1].click();
                    return true;
                }
            }
            return false;
        })()
    `);
    assert(clicked, "未找到举报处理快捷按钮");
    await sleep(1500);
}

async function collectVisibleSummary(cdp) {
    return cdp.evaluate(`
        (() => ({
            path: location.pathname,
            title: document.title,
            text: (document.body.innerText || "").slice(0, 400)
        }))()
    `);
}

async function main() {
    const users = buildUsers();
    const usernames = Object.values(users).map((item) => item.username);
    const screenshots = [];
    const findings = [];
    let cdp = null;

    try {
        logStep("setup", "清理旧的浏览器验证测试数据");
        await cleanupTestData(usernames);

        logStep("setup", "准备 API 测试账号");
        await createUser(users.buyer);
        await createUser(users.admin);
        await promoteAdmin(users.admin.username);
        const buyerAuth = await loginUser(users.buyer);
        const adminAuth = await loginUser(users.admin);

        logStep("cdp", "读取 Chrome 页面调试地址");
        const sellerWsUrl = await getFirstPageWsUrl();
        cdp = new CdpClient(sellerWsUrl);
        await cdp.connect();
        logStep("cdp", "连接完成");

        logStep("desktop", "桌面端注册卖家并发布商品");
        await cdp.setViewport({ width: 1440, height: 960, mobile: false });
        await cdp.navigate(`${FRONTEND_URL}/home`);
        await clearAuthStorage(cdp);
        await registerThroughUi(cdp, users.seller);
        screenshots.push(await cdp.screenshot("desktop-home-after-register.png"));
        const productId = await publishThroughUi(cdp, `桌面端验证商品-${Date.now().toString().slice(-4)}`);
        screenshots.push(await cdp.screenshot("desktop-product-detail.png"));
        const sellerAuth = await loginUser(users.seller);

        const createdPost = await httpJson("POST", "/api/posts", {
            content: "桌面端与移动端实浏览器验证帖子",
            images_json: "[]",
            campus: "main"
        }, sellerAuth.token);
        assert(createdPost.data.code === 200, `创建帖子失败: ${JSON.stringify(createdPost.data)}`);
        const postId = createdPost.data.data.id;

        await cdp.navigate(`${FRONTEND_URL}/profile`);
        await cdp.waitForFunction(`location.pathname === "/profile"`);
        screenshots.push(await cdp.screenshot("desktop-profile.png"));

        await cdp.navigate(`${FRONTEND_URL}/messages`);
        await cdp.waitForFunction(`location.pathname === "/messages"`);
        screenshots.push(await cdp.screenshot("desktop-messages-empty.png"));

        await cdp.navigate(`${FRONTEND_URL}/profile`);
        await clickButtonByText(cdp, "退出登录");
        await cdp.waitForFunction(`location.pathname === "/home"`, 15000);

        logStep("desktop", "桌面端登录买家并验证聊天、举报、帖子详情");
        await loginThroughUi(cdp, users.buyer);
        await searchAndOpenChat(cdp, users.seller.username);
        await sendChatMessage(cdp, "桌面端浏览器验证消息");
        screenshots.push(await cdp.screenshot("desktop-chat.png"));

        await cdp.navigate(`${FRONTEND_URL}/product/${productId}`);
        await cdp.waitForFunction(`location.pathname === "/product/${productId}"`);
        screenshots.push(await cdp.screenshot("desktop-product-detail-buyer.png"));
        const reportResult = await httpJson("POST", "/api/reports", {
            target_type: "product",
            target_id: productId,
            reason: "misleading",
            description: "桌面端实浏览器验证创建的商品举报"
        }, buyerAuth.token);
        assert(reportResult.data.code === 200, `创建举报失败: ${JSON.stringify(reportResult.data)}`);

        await cdp.navigate(`${FRONTEND_URL}/post/${postId}`);
        await cdp.waitForFunction(`location.pathname === "/post/${postId}"`);
        screenshots.push(await cdp.screenshot("desktop-post-detail.png"));

        logStep("desktop", "桌面端验证后台举报处理页");
        await setAuthStorage(cdp, adminAuth);
        await cdp.navigate(`${FRONTEND_URL}/moderation/reports`);
        await cdp.waitForFunction(`location.pathname === "/moderation/reports"`, 15000);
        screenshots.push(await cdp.screenshot("desktop-moderation.png"));
        try {
            await quickResolveReport(cdp);
            screenshots.push(await cdp.screenshot("desktop-moderation-after-action.png"));
        } catch (error) {
            findings.push(`举报处理页未能完成快捷操作：${error.message}`);
            screenshots.push(await cdp.screenshot("desktop-moderation-action-failed.png"));
        }

        logStep("mobile", "移动端复跑关键页面");
        await cdp.setViewport({ width: 390, height: 844, mobile: true });
        await setAuthStorage(cdp, buyerAuth);
        await cdp.navigate(`${FRONTEND_URL}/home`);
        screenshots.push(await cdp.screenshot("mobile-home.png"));
        await cdp.navigate(`${FRONTEND_URL}/product/${productId}`);
        screenshots.push(await cdp.screenshot("mobile-product-detail.png"));
        await cdp.navigate(`${FRONTEND_URL}/post/${postId}`);
        screenshots.push(await cdp.screenshot("mobile-post-detail.png"));
        await cdp.navigate(`${FRONTEND_URL}/messages`);
        screenshots.push(await cdp.screenshot("mobile-messages.png"));
        await cdp.navigate(`${FRONTEND_URL}/profile`);
        screenshots.push(await cdp.screenshot("mobile-profile.png"));
        await cdp.navigate(`${FRONTEND_URL}/publish`);
        screenshots.push(await cdp.screenshot("mobile-publish.png"));

        const registerSummary = await collectVisibleSummary(cdp);
        if ((registerSummary.text || "").includes("????") || /鍒|娉|璇|鐧/i.test(registerSummary.text || "")) {
            findings.push("页面存在明显文案乱码，至少注册页、发布页、消息页相关文本未完全恢复为简体中文。");
        }

        const orderEntryExists = await cdp.evaluate(`
            (() => {
                const text = document.body.innerText || "";
                return text.includes("下单") || text.includes("拍下") || text.includes("订单");
            })()
        `);
        if (!orderEntryExists) {
            findings.push("前端关键路径里没有可执行的下单入口，当前无法在实浏览器中完成订单流程验证。");
        }

        const report = {
            ok: findings.length === 0,
            findings,
            screenshots
        };
        const reportPath = path.join(OUTPUT_DIR, "report.json");
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 4));
        console.log(JSON.stringify(report, null, 4));
    } finally {
        if (cdp) {
            try {
                await clearAuthStorage(cdp);
            } catch {}
            cdp.close();
        }
        await cleanupTestData(usernames);
        logStep("cleanup", "浏览器验证测试数据已清理");
    }
}

main().catch((error) => {
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
});
