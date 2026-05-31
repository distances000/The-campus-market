import { createRouter, createWebHistory } from "vue-router";
import MainLayout from "../components/MainLayout.vue";
import { useUserStore } from "../stores/user";

const FORCE_PASSWORD_QUERY = { changePassword: "1" };

const routes = [
    {
        path: "/",
        component: MainLayout,
        redirect: "/home",
        children: [
            { path: "home", name: "Home", component: () => import("../views/Home.vue"), meta: { title: "首页" } },
            { path: "school-circle", name: "SchoolCircle", component: () => import("../views/SchoolCircle.vue"), meta: { title: "校园圈" } },
            { path: "messages", name: "Messages", component: () => import("../views/Messages.vue"), meta: { title: "消息", requiresAuth: true } },
            { path: "profile", name: "Profile", component: () => import("../views/Profile.vue"), meta: { title: "我的", requiresAuth: true } },
            { path: "publish/:id?", name: "Publish", component: () => import("../views/Publish.vue"), meta: { title: "发布", requiresAuth: true } },
            { path: "product/:id", name: "ProductDetail", component: () => import("../views/ProductDetail.vue"), meta: { title: "商品详情" } },
            { path: "post/:id", name: "PostDetail", component: () => import("../views/PostDetail.vue"), meta: { title: "帖子详情" } },
            { path: "user/:id", name: "UserDetail", component: () => import("../views/UserDetail.vue"), meta: { title: "用户资料", requiresAuth: true } },
            { path: "chat/:userId", name: "Chat", component: () => import("../views/Chat.vue"), meta: { title: "聊天", requiresAuth: true } }
        ]
    },
    {
        path: "/admin",
        component: () => import("../components/AdminLayout.vue"),
        redirect: "/admin/reports",
        meta: { title: "管理员后台", requiresAuth: true, requiresAdmin: true },
        children: [
            { path: "reports", name: "AdminReports", component: () => import("../views/AdminReports.vue"), meta: { title: "举报管理", requiresAuth: true, requiresAdmin: true } },
            { path: "password-resets", name: "AdminPasswordResets", component: () => import("../views/AdminPasswordResets.vue"), meta: { title: "密码重置", requiresAuth: true, requiresAdmin: true } }
        ]
    },
    { path: "/login", name: "Login", component: () => import("../views/Login.vue"), meta: { title: "登录" } },
    { path: "/register", name: "Register", component: () => import("../views/Register.vue"), meta: { title: "注册" } },
    { path: "/forgot-password", name: "ForgotPassword", component: () => import("../views/ForgotPassword.vue"), meta: { title: "找回密码" } }
];

const router = createRouter({
    history: createWebHistory(),
    routes
});

router.beforeEach(async (to, from, next) => {
    const userStore = useUserStore();

    if (!userStore.authInitialized && userStore.token) {
        await userStore.ensureAuth();
    }

    document.title = to.meta.title ? `${to.meta.title} - 校园集市` : "校园集市";

    if (to.meta.requiresAuth && !userStore.isLoggedIn) {
        return next({ path: "/login", query: { redirect: to.fullPath } });
    }

    if (to.meta.requiresAdmin && !userStore.user?.is_admin) {
        return next({ path: "/profile" });
    }

    if (userStore.isLoggedIn && userStore.user?.must_change_password) {
        if (to.name === "Profile" && to.query.changePassword !== "1") {
            return next({ path: "/profile", query: { ...to.query, ...FORCE_PASSWORD_QUERY } });
        }
        if (to.name !== "Profile") {
            return next({ path: "/profile", query: FORCE_PASSWORD_QUERY });
        }
    }

    next();
});

export default router;
