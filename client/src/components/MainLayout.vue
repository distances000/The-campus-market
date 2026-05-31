<template>
    <div class="main-layout">
        <header class="top-header">
            <div class="header-inner">
                <router-link to="/home" class="logo">
                    <span class="logo-icon">C</span>
                    <span class="logo-text">校园集市</span>
                </router-link>

                <div class="header-search" v-if="showSearch">
                    <el-input
                        v-model="searchKeyword"
                        placeholder="搜索商品..."
                        :prefix-icon="Search"
                        size="large"
                        clearable
                        @keyup.enter="doSearch"
                        class="search-input"
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
                <el-icon><Shop /></el-icon>
                <span>首页</span>
            </router-link>

            <router-link to="/school-circle" class="nav-item" :class="{ active: $route.path === '/school-circle' }">
                <el-icon><ChatDotRound /></el-icon>
                <span>校园圈</span>
            </router-link>

            <router-link to="/messages" class="nav-item" :class="{ active: $route.path === '/messages' }">
                <el-icon><Message /></el-icon>
                <span>消息</span>
                <span class="badge" v-if="unreadCount > 0">{{ unreadCount > 99 ? "99+" : unreadCount }}</span>
            </router-link>

            <router-link to="/profile" class="nav-item" :class="{ active: $route.path === '/profile' }">
                <el-icon><User /></el-icon>
                <span>我的</span>
            </router-link>
        </nav>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { Plus, Shop, ChatDotRound, Message, User, Search } from "./element-icons";
import { useRoute, useRouter } from "vue-router";
import { useUserStore } from "../stores/user";
import { getUnreadCount } from "../api/messages";

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

const searchKeyword = ref("");
const unreadCount = ref(0);
const showSearch = computed(() => ["/home", "/"].includes(route.path));
const showPublish = computed(() => ["/home", "/"].includes(route.path));
let unreadTimer = null;

function doSearch() {
    const keyword = searchKeyword.value.trim();
    if (!keyword) return;
    router.push({ path: "/home", query: { keyword } });
}

async function fetchUnread() {
    if (!userStore.isLoggedIn) {
        unreadCount.value = 0;
        return;
    }
    if (document.visibilityState === "hidden") return;
    try {
        const response = await getUnreadCount();
        unreadCount.value = response.data.unread_count;
    } catch {
        // ignore
    }
}

function startUnreadPolling() {
    stopUnreadPolling();
    fetchUnread();
    unreadTimer = window.setInterval(fetchUnread, 10000);
}

function stopUnreadPolling() {
    if (!unreadTimer) return;
    window.clearInterval(unreadTimer);
    unreadTimer = null;
}

function handleVisibilityChange() {
    if (document.visibilityState === "visible") fetchUnread();
}

onMounted(() => {
    startUnreadPolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);
});
onUnmounted(() => {
    stopUnreadPolling();
    document.removeEventListener("visibilitychange", handleVisibilityChange);
});
watch(() => route.path, () => fetchUnread());
watch(() => userStore.isLoggedIn, (loggedIn) => {
    if (loggedIn) startUnreadPolling();
    else stopUnreadPolling();
});
</script>

<style scoped>
.main-layout {
    min-height: 100vh;
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
    width: min(720px, calc(100vw - 20px));
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

.nav-item .el-icon {
    font-size: 22px;
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
        width: calc(100vw - 12px);
        border-radius: 28px;
    }
}
</style>
