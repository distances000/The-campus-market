<template>
    <div class="moderation-shell">
        <aside class="moderation-sidebar">
            <div class="moderation-brand">
                <div class="moderation-brand-mark">M</div>
                <div class="moderation-brand-copy">
                    <div class="moderation-brand-eyebrow">违规处理台</div>
                    <div class="moderation-brand-title">校园集市</div>
                </div>
            </div>

            <div class="moderation-account">
                <el-avatar :size="52">{{ profileInitial }}</el-avatar>
                <div class="moderation-account-copy">
                    <div class="moderation-account-name">{{ displayName }}</div>
                    <div class="moderation-account-meta">当前账号具备违规处理权限</div>
                </div>
            </div>

            <nav class="moderation-nav">
                <router-link
                    v-for="item in navItems"
                    :key="item.path"
                    :to="item.path"
                    class="moderation-nav-item"
                    :class="{ active: route.path === item.path }"
                >
                    <span class="moderation-nav-label">{{ item.label }}</span>
                    <span class="moderation-nav-desc">{{ item.description }}</span>
                </router-link>
            </nav>

            <div class="moderation-sidebar-footer">
                <el-button type="primary" style="width: 100%" @click="goFront">返回前台</el-button>
                <el-button plain style="width: 100%" @click="goProfile">个人中心</el-button>
            </div>
        </aside>

        <div class="moderation-main">
            <header class="moderation-topbar">
                <div>
                    <div class="moderation-topbar-eyebrow">违规审核</div>
                    <h1>{{ pageTitle }}</h1>
                </div>
                <div class="moderation-topbar-actions">
                    <el-tag type="info">处理权限</el-tag>
                    <el-button text @click="goFront">返回前台</el-button>
                </div>
            </header>

            <main class="moderation-content">
                <router-view />
            </main>
        </div>
    </div>
</template>

<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useUserStore } from "../stores/user";

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

const navItems = [
    {
        path: "/moderation/reports",
        label: "举报管理",
        description: "处理商品和帖子举报"
    },
    {
        path: "/moderation/password-resets",
        label: "密码重置",
        description: "审核申请并设置临时密码"
    }
];

const displayName = computed(() => userStore.user?.nickname || userStore.user?.username || "处理员");
const profileInitial = computed(() => (displayName.value || "M").slice(0, 1));
const pageTitle = computed(() => route.meta?.title || "违规处理台");

function goFront() {
    router.push("/home");
}

function goProfile() {
    router.push("/profile");
}
</script>

<style scoped>
.moderation-shell {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 280px minmax(0, 1fr);
    gap: 20px;
    padding: 20px;
}

.moderation-sidebar {
    position: sticky;
    top: 20px;
    align-self: start;
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 20px;
    border-radius: 32px;
    background:
        radial-gradient(circle at top right, rgba(255, 233, 196, 0.66), transparent 34%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(246, 243, 251, 0.92));
    border: 1px solid rgba(194, 199, 208, 0.22);
    box-shadow: var(--shadow-lg);
}

.moderation-brand {
    display: flex;
    align-items: center;
    gap: 14px;
}

.moderation-brand-mark {
    width: 48px;
    height: 48px;
    border-radius: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #8f4e00 0%, #c97a00 100%);
    color: #fff;
    font-size: 18px;
    font-weight: 800;
    box-shadow: var(--shadow-md);
}

.moderation-brand-eyebrow,
.moderation-topbar-eyebrow {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #8f4e00;
}

.moderation-brand-title {
    margin-top: 4px;
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -0.02em;
}

.moderation-account {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px;
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.82);
    border: 1px solid rgba(194, 199, 208, 0.18);
}

.moderation-account-copy {
    min-width: 0;
}

.moderation-account-name {
    font-size: 15px;
    font-weight: 700;
}

.moderation-account-meta {
    margin-top: 4px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-tertiary);
}

.moderation-nav {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.moderation-nav-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 14px 16px;
    border-radius: 22px;
    color: var(--text-secondary);
    background: rgba(255, 255, 255, 0.62);
    border: 1px solid transparent;
    transition: transform 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease, color 0.2s ease;
}

.moderation-nav-item:hover {
    transform: translateY(-1px);
    background: rgba(255, 244, 217, 0.88);
    box-shadow: var(--shadow);
}

.moderation-nav-item.active {
    color: #8f4e00;
    background: rgba(255, 232, 196, 0.9);
    box-shadow: inset 0 0 0 1px rgba(143, 78, 0, 0.12);
}

.moderation-nav-label {
    font-size: 14px;
    font-weight: 700;
}

.moderation-nav-desc {
    font-size: 12px;
    line-height: 1.45;
    color: inherit;
    opacity: 0.8;
}

.moderation-sidebar-footer {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: auto;
}

.moderation-main {
    min-width: 0;
}

.moderation-topbar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 16px;
    padding: 18px 20px;
    border-radius: 28px;
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid rgba(194, 199, 208, 0.18);
    box-shadow: var(--shadow);
}

.moderation-topbar h1 {
    margin-top: 6px;
    font-size: 28px;
    font-weight: 800;
    letter-spacing: -0.03em;
}

.moderation-topbar-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
}

.moderation-content {
    min-width: 0;
}

@media (max-width: 960px) {
    .moderation-shell {
        grid-template-columns: 1fr;
    }

    .moderation-sidebar {
        position: static;
    }
}

@media (max-width: 640px) {
    .moderation-shell {
        padding: 12px;
        gap: 12px;
    }

    .moderation-sidebar,
    .moderation-topbar {
        border-radius: 24px;
    }

    .moderation-nav {
        overflow-x: auto;
        flex-direction: row;
        padding-bottom: 4px;
    }

    .moderation-nav-item {
        min-width: 220px;
        flex-shrink: 0;
    }

    .moderation-topbar {
        flex-direction: column;
    }

    .moderation-topbar h1 {
        font-size: 24px;
    }
}
</style>
