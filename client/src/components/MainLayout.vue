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

                    <template v-else>
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
import { ref, computed, onMounted, watch } from "vue";
import { Plus, Shop, ChatDotRound, Message, User, Search } from "@element-plus/icons-vue";
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

function doSearch() {
    const keyword = searchKeyword.value.trim();
    if (!keyword) return;
    router.push({ path: "/home", query: { keyword } });
}

async function fetchUnread() {
    if (!userStore.isLoggedIn) return;
    try {
        const response = await getUnreadCount();
        unreadCount.value = response.data.unread_count;
    } catch {
        // ignore
    }
}

onMounted(() => fetchUnread());
watch(() => route.path, () => fetchUnread());
</script>

<style scoped>
.main-layout{min-height:100vh;display:flex;flex-direction:column;padding-bottom:64px;}
.top-header{background:var(--bg-primary);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:100;height:var(--header-height);}
.header-inner{max-width:1200px;margin:0 auto;height:100%;display:flex;align-items:center;gap:20px;padding:0 16px;}
.logo{display:flex;align-items:center;gap:8px;flex-shrink:0;}
.logo-icon{width:32px;height:32px;background:var(--primary);color:#fff;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;}
.logo-text{font-size:18px;font-weight:700;color:var(--text-primary);}
.header-search{flex:1;max-width:480px;}
.header-actions{flex-shrink:0;display:flex;gap:8px;}
.main-content{flex:1;}
.bottom-nav{position:fixed;bottom:0;left:0;right:0;background:var(--bg-primary);border-top:1px solid var(--border);display:flex;z-index:100;height:56px;}
.nav-item{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:10px;color:var(--text-tertiary);position:relative;transition:color 0.2s;}
.nav-item.active{color:var(--primary);}
.nav-item .el-icon{font-size:22px;}
.badge{position:absolute;top:4px;right:calc(50% - 24px);background:var(--danger);color:#fff;font-size:10px;min-width:16px;height:16px;border-radius:8px;display:flex;align-items:center;justify-content:center;padding:0 4px;}
</style>
