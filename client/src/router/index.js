import { createRouter, createWebHistory } from "vue-router";
import { useUserStore } from "../stores/user";
import MainLayout from "../components/MainLayout.vue";

const routes = [
    { path: "/", component: MainLayout, redirect: "/home", children: [
        { path: "home", name: "Home", component: () => import("../views/Home.vue"), meta: { title: "????" } },
        { path: "school-circle", name: "SchoolCircle", component: () => import("../views/SchoolCircle.vue"), meta: { title: "??" } },
        { path: "messages", name: "Messages", component: () => import("../views/Messages.vue"), meta: { title: "??", requiresAuth: true } },
        { path: "profile", name: "Profile", component: () => import("../views/Profile.vue"), meta: { title: "????", requiresAuth: true } },
        { path: "publish/:id?", name: "Publish", component: () => import("../views/Publish.vue"), meta: { title: "????", requiresAuth: true } },
        { path: "product/:id", name: "ProductDetail", component: () => import("../views/ProductDetail.vue"), meta: { title: "????" } },
        { path: "post/:id", name: "PostDetail", component: () => import("../views/PostDetail.vue"), meta: { title: "????" } },
        { path: "chat/:userId", name: "Chat", component: () => import("../views/Chat.vue"), meta: { title: "??", requiresAuth: true } },
    ]},
    { path: "/login", name: "Login", component: () => import("../views/Login.vue"), meta: { title: "??" } },
    { path: "/register", name: "Register", component: () => import("../views/Register.vue"), meta: { title: "??" } },
];

const r = createRouter({ history: createWebHistory(), routes });
r.beforeEach(async (to, from, next) => {
    const userStore = useUserStore();
    if (!userStore.authInitialized && userStore.token) {
        await userStore.ensureAuth();
    }
    document.title = to.meta.title ? to.meta.title + " - ????" : "????";
    if (to.meta.requiresAuth) {
        if (!useUserStore().isLoggedIn) return next({ path: "/login", query: { redirect: to.fullPath } });
    }
    next();
});
export default r;
