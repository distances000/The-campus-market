<template>
    <div class="admin-shell">
        <aside class="admin-sidebar">
            <div class="admin-brand">
                <div class="admin-brand-mark">A</div>
                <div class="admin-brand-copy">
                    <div class="admin-brand-eyebrow">管理员后台</div>
                    <div class="admin-brand-title">校园集市</div>
                </div>
            </div>

            <div class="admin-account">
                <el-avatar :size="52">{{ profileInitial }}</el-avatar>
                <div class="admin-account-copy">
                    <div class="admin-account-name">{{ displayName }}</div>
                    <div class="admin-account-meta">当前账号拥有管理员权限</div>
                </div>
            </div>

            <nav class="admin-nav">
                <router-link
                    v-for="item in navItems"
                    :key="item.path"
                    :to="item.path"
                    class="admin-nav-item"
                    :class="{ active: route.path === item.path }"
                >
                    <span class="admin-nav-label">{{ item.label }}</span>
                    <span class="admin-nav-desc">{{ item.description }}</span>
                </router-link>
            </nav>

            <div class="admin-sidebar-footer">
                <el-button type="primary" style="width: 100%" @click="goFront">返回前台</el-button>
                <el-button plain style="width: 100%" @click="goProfile">个人中心</el-button>
            </div>
        </aside>

        <div class="admin-main">
            <header class="admin-topbar">
                <div>
                    <div class="admin-topbar-eyebrow">系统管理</div>
                    <h1>{{ pageTitle }}</h1>
                </div>
                <div class="admin-topbar-actions">
                    <el-tag type="info">管理员</el-tag>
                    <el-button text @click="goFront">返回前台</el-button>
                </div>
            </header>

            <main class="admin-content">
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
        path: "/admin/dashboard",
        label: "管理概览",
        description: "查看平台运行状态、待处理举报和重点指标"
    },
    {
        path: "/moderation/reports",
        label: "举报管理",
        description: "处理商品和帖子举报，执行下架或删除动作"
    },
    {
        path: "/moderation/password-resets",
        label: "密码重置",
        description: "审核找回密码申请并设置临时密码"
    }
];

const displayName = computed(() => userStore.user?.nickname || userStore.user?.username || "管理员");
const profileInitial = computed(() => (displayName.value || "A").slice(0, 1));
const pageTitle = computed(() => route.meta?.title || "管理员后台");

function goFront() {
    router.push("/home");
}

function goProfile() {
    router.push("/profile");
}
</script>

<style scoped>
.admin-shell {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 280px minmax(0, 1fr);
    gap: 20px;
    padding: 20px;
}

.admin-sidebar {
    position: sticky;
    top: 20px;
    align-self: start;
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 20px;
    border-radius: 32px;
    background:
        radial-gradient(circle at top right, rgba(214, 227, 255, 0.62), transparent 34%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(246, 243, 251, 0.92));
    border: 1px solid rgba(194, 199, 208, 0.22);
    box-shadow: var(--shadow-lg);
}

.admin-brand {
    display: flex;
    align-items: center;
    gap: 14px;
}

.admin-brand-mark {
    width: 48px;
    height: 48px;
    border-radius: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--primary) 0%, #6f7fd6 100%);
    color: #fff;
    font-size: 18px;
    font-weight: 800;
    box-shadow: var(--shadow-md);
}

.admin-brand-eyebrow,
.admin-topbar-eyebrow {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--primary);
}

.admin-brand-title {
    margin-top: 4px;
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -0.02em;
}

.admin-account {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px;
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.82);
    border: 1px solid rgba(194, 199, 208, 0.18);
}

.admin-account-copy {
    min-width: 0;
}

.admin-account-name {
    font-size: 15px;
    font-weight: 700;
}

.admin-account-meta {
    margin-top: 4px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-tertiary);
}

.admin-nav {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.admin-nav-item {
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

.admin-nav-item:hover {
    transform: translateY(-1px);
    background: rgba(240, 245, 255, 0.9);
    box-shadow: var(--shadow);
}

.admin-nav-item.active {
    color: var(--primary);
    background: rgba(214, 227, 255, 0.9);
    box-shadow: inset 0 0 0 1px rgba(65, 95, 145, 0.12);
}

.admin-nav-label {
    font-size: 14px;
    font-weight: 700;
}

.admin-nav-desc {
    font-size: 12px;
    line-height: 1.45;
    color: inherit;
    opacity: 0.8;
}

.admin-sidebar-footer {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: auto;
}

.admin-main {
    min-width: 0;
}

.admin-topbar {
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

.admin-topbar h1 {
    margin-top: 6px;
    font-size: 28px;
    font-weight: 800;
    letter-spacing: -0.03em;
}

.admin-topbar-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
}

.admin-content {
    min-width: 0;
}

@media (max-width: 960px) {
    .admin-shell {
        grid-template-columns: 1fr;
    }

    .admin-sidebar {
        position: static;
    }
}

@media (max-width: 640px) {
    .admin-shell {
        padding: 12px;
        gap: 12px;
    }

    .admin-sidebar,
    .admin-topbar {
        border-radius: 24px;
    }

    .admin-nav {
        overflow-x: auto;
        flex-direction: row;
        padding-bottom: 4px;
    }

    .admin-nav-item {
        min-width: 220px;
        flex-shrink: 0;
    }

    .admin-topbar {
        flex-direction: column;
    }

    .admin-topbar h1 {
        font-size: 24px;
    }
}
</style>
