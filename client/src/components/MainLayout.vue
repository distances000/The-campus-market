<template>
    <div class="main-layout">
        <header class="top-header">
            <div class="header-inner">
                <router-link to="/home" class="logo">
                    <span class="logo-icon">C</span>
                    <span class="logo-text">校园集市</span>
                </router-link>

                <div v-if="showSearch" class="header-search">
                    <el-input
                        v-model="searchKeyword"
                        class="search-input"
                        placeholder="搜索商品..."
                        :prefix-icon="Search"
                        size="large"
                        clearable
                        @keyup.enter="doSearch"
                    />
                </div>

                <div class="header-actions">
                    <el-button
                        v-if="userStore.isLoggedIn && showPublish"
                        type="primary"
                        size="large"
                        @click="$router.push('/publish')"
                    >
                        <el-icon><Plus /></el-icon>
                        发布
                    </el-button>

                    <template v-else-if="!userStore.isLoggedIn">
                        <el-button size="large" @click="$router.push('/login')">登录</el-button>
                        <el-button type="primary" size="large" @click="$router.push('/register')">注册</el-button>
                    </template>
                </div>
            </div>
        </header>

        <main class="main-content">
            <router-view />
        </main>

        <nav class="bottom-nav">
            <router-link to="/home" class="nav-item" :class="{ active: $route.path === '/home' }">
                <span>首页</span>
            </router-link>

            <router-link to="/school-circle" class="nav-item" :class="{ active: $route.path === '/school-circle' }">
                <span>校园圈</span>
            </router-link>

            <router-link to="/messages" class="nav-item" :class="{ active: $route.path === '/messages' }">
                <span>消息</span>
                <span v-if="unreadCount > 0" class="badge">{{ unreadCount > 99 ? "99+" : unreadCount }}</span>
            </router-link>

            <router-link to="/profile" class="nav-item" :class="{ active: $route.path === '/profile' }">
                <span>我的</span>
            </router-link>
        </nav>
    </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Plus, Search } from "./element-icons";
import { useUserStore } from "../stores/user";
import { getUnreadCount } from "../api/messages";
import { subscribeMessageStream } from "../utils/message-stream";
import { ElNotification } from "../utils/message";

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

const searchKeyword = ref("");
const unreadCount = ref(0);
const showSearch = computed(() => ["/home", "/"].includes(route.path));
const showPublish = computed(() => ["/home", "/"].includes(route.path));
let unreadTimer = null;
let unsubscribeStream = null;

function getNotificationRouteTarget(notification) {
    const objectType = notification?.object_type;
    const objectId = Number(notification?.object_id);
    const extra = notification?.extra || {};

    if (objectType === "product" && objectId) {
        return `/product/${objectId}`;
    }
    if (objectType === "post" && objectId) {
        return `/post/${objectId}`;
    }
    if (objectType === "friend" && objectId) {
        return `/user/${objectId}`;
    }
    if ((objectType === "order" || objectType === "review") && extra.product_id) {
        return `/product/${extra.product_id}`;
    }
    return "/messages";
}

function getNotificationPresentation(notification) {
    const eventType = notification?.event_type;
    const content = typeof notification?.content === "string" ? notification.content.trim() : "";

    const presets = {
        order_created: {
            title: "您的商品已被拍下",
            type: "success"
        },
        post_commented: {
            title: "您收到了一条新评论",
            type: "info"
        },
        post_liked: {
            title: "有人赞了你的校园墙",
            type: "info"
        },
        product_favorited: {
            title: "有人收藏了您的商品",
            type: "info"
        },
        order_completed: {
            title: "买家已确认订单完成",
            type: "success"
        },
        order_cancelled: {
            title: "订单状态有更新",
            type: "warning"
        },
        review_received: {
            title: "您收到了一条新评价",
            type: "success"
        },
        friend_added: {
            title: "您有新的好友",
            type: "info"
        },
        report_processed: {
            title: "举报处理结果已更新",
            type: "info"
        }
    };

    const preset = presets[eventType] || {};
    return {
        title: preset.title || notification?.title || "您有一条新通知",
        message: content || "点击查看详情",
        type: preset.type || (notification?.kind === "system" ? "success" : "info"),
        target: getNotificationRouteTarget(notification)
    };
}

function openNotificationTarget(target) {
    if (!target) {
        return;
    }
    router.push(target).catch(() => {});
}

function showIncomingNotification(notification) {
    if (!notification?.id) {
        return;
    }

    const presentation = getNotificationPresentation(notification);
    ElNotification[presentation.type]?.({
        title: presentation.title,
        message: presentation.message,
        duration: 4200,
        onClick: () => openNotificationTarget(presentation.target)
    });
}

function doSearch() {
    const keyword = searchKeyword.value.trim();
    if (!keyword) {
        return;
    }
    router.push({ path: "/home", query: { keyword } });
}

async function fetchUnread() {
    if (!userStore.isLoggedIn) {
        unreadCount.value = 0;
        return;
    }
    if (document.visibilityState === "hidden") {
        return;
    }
    try {
        const response = await getUnreadCount();
        unreadCount.value = response.data.unread_count;
    } catch {}
}

function startUnreadPolling() {
    stopUnreadPolling();
    fetchUnread();
    unreadTimer = window.setInterval(fetchUnread, 30000);
}

function stopUnreadPolling() {
    if (!unreadTimer) {
        return;
    }
    window.clearInterval(unreadTimer);
    unreadTimer = null;
}

function bindStream() {
    if (unsubscribeStream) {
        unsubscribeStream();
        unsubscribeStream = null;
    }
    if (!userStore.token) {
        unreadCount.value = 0;
        return;
    }

    unsubscribeStream = subscribeMessageStream(userStore.token, {
        onUnreadSummary: (summary) => {
            unreadCount.value = summary?.unread_count || 0;
        },
        onNotificationCreated: (notification) => {
            showIncomingNotification(notification);
        }
    });
}

function handleVisibilityChange() {
    if (document.visibilityState === "visible") {
        fetchUnread();
    }
}

onMounted(() => {
    bindStream();
    startUnreadPolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);
});

onUnmounted(() => {
    stopUnreadPolling();
    if (unsubscribeStream) {
        unsubscribeStream();
        unsubscribeStream = null;
    }
    document.removeEventListener("visibilitychange", handleVisibilityChange);
});

watch(() => route.path, () => fetchUnread());
watch(() => userStore.token, () => {
    bindStream();
    if (userStore.isLoggedIn) {
        startUnreadPolling();
    } else {
        stopUnreadPolling();
        unreadCount.value = 0;
    }
});
</script>

<style scoped>
.main-layout {
    min-height: var(--app-screen-height);
    display: flex;
    flex-direction: column;
    padding-bottom: 90px;
}

.top-header {
    position: sticky;
    top: 0;
    z-index: 100;
    height: var(--header-height);
    background: rgba(252, 248, 255, 0.82);
    border-bottom: 1px solid rgba(194, 199, 208, 0.42);
    backdrop-filter: blur(18px);
}

.header-inner {
    max-width: 1240px;
    margin: 0 auto;
    height: 100%;
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 0 20px;
}

.logo {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
}

.logo-icon {
    width: 40px;
    height: 40px;
    background: linear-gradient(135deg, var(--primary) 0%, #6f7fd6 100%);
    color: #fff;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 18px;
    box-shadow: var(--shadow-md);
}

.logo-text {
    font-size: 20px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: 0.01em;
}

.header-search {
    flex: 1;
    max-width: 560px;
}

.search-input :deep(.el-input__wrapper) {
    min-height: 50px;
    border-radius: 999px;
    background: rgba(240, 242, 248, 0.96);
}

.header-actions {
    flex-shrink: 0;
    display: flex;
    gap: 10px;
    align-items: center;
}

.main-content {
    flex: 1;
}

.bottom-nav {
    position: fixed;
    left: 50%;
    bottom: 16px;
    transform: translateX(-50%);
    width: min(720px, calc(100% - 20px));
    height: 72px;
    padding: 8px 12px;
    display: flex;
    gap: 6px;
    z-index: 120;
    background: rgba(240, 242, 248, 0.94);
    border: 1px solid rgba(194, 199, 208, 0.38);
    border-radius: 36px;
    backdrop-filter: blur(18px);
    box-shadow: var(--shadow-lg);
}

.nav-item {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-secondary);
    position: relative;
    border-radius: 28px;
    transition: color 0.2s ease, background-color 0.2s ease, transform 0.2s ease;
}

.nav-item.active {
    color: var(--primary);
    background: rgba(214, 227, 255, 0.9);
}

.nav-item:hover {
    background: rgba(214, 227, 255, 0.54);
}


.badge {
    position: absolute;
    top: 8px;
    right: calc(50% - 28px);
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 700;
    color: #fff;
    background: var(--badge-bg);
    box-shadow: 0 0 0 3px rgba(240, 242, 248, 0.94);
}

@media (max-width: 640px) {
    .header-inner {
        gap: 12px;
        padding: 0 12px;
    }

    .logo-text {
        display: none;
    }

    .header-search {
        max-width: none;
    }

    .bottom-nav {
        bottom: 10px;
        width: calc(100% - 12px);
        border-radius: 28px;
    }
}
</style>

