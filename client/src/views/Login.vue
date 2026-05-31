<template>
    <div class="auth-page">
        <div class="auth-card">
            <div class="auth-header">
                <div class="auth-logo">C</div>
                <h1>欢迎回来</h1>
                <p>登录后继续管理你的商品、收藏和消息</p>
            </div>

            <el-form ref="formRef" :model="form" :rules="rules" size="large" @submit.prevent="handleLogin">
                <el-form-item prop="username">
                    <el-input v-model="form.username" placeholder="请输入用户名" :prefix-icon="User" autocomplete="username" />
                </el-form-item>
                <el-form-item prop="password">
                    <el-input
                        v-model="form.password"
                        type="password"
                        placeholder="请输入密码"
                        :prefix-icon="Lock"
                        show-password
                        autocomplete="current-password"
                        @keyup.enter="handleLogin"
                    />
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" native-type="submit" :loading="loading" style="width: 100%">登录</el-button>
                </el-form-item>
            </el-form>

            <div class="auth-footer">
                还没有账号？
                <router-link :to="registerLink">去注册</router-link>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "../utils/message";
import { User, Lock } from "../components/element-icons";
import { useUserStore } from "../stores/user";
import { login as loginApi } from "../api/auth";

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();

const formRef = ref(null);
const loading = ref(false);
const form = reactive({ username: "", password: "" });

const redirectTo = computed(() => (typeof route.query.redirect === "string" ? route.query.redirect : "/home"));
const registerLink = computed(() => (redirectTo.value ? { path: "/register", query: { redirect: redirectTo.value } } : "/register"));

const rules = {
    username: [{ required: true, message: "请输入用户名", trigger: "blur" }],
    password: [{ required: true, message: "请输入密码", trigger: "blur" }]
};

async function handleLogin() {
    const valid = await formRef.value.validate().catch(() => false);
    if (!valid) {
        return;
    }
    loading.value = true;
    try {
        const response = await loginApi(form.username, form.password);
        userStore.setAuth(response.data.token, response.data.user);
        userStore.authInitialized = true;
        ElMessage.success("登录成功");
        await router.replace(redirectTo.value || "/home");
    } catch {
    } finally {
        loading.value = false;
    }
}

onMounted(() => {
    userStore.ensureAuth().then(() => {
        if (!userStore.isLoggedIn) {
            return;
        }
        router.replace(redirectTo.value || "/home");
    });
});
</script>

<style scoped>
.auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #eef2ff 0%, #f8fafc 45%, #ffffff 100%); padding: 20px; }
.auth-card { width: 400px; max-width: 100%; background: var(--bg-primary); border-radius: 20px; padding: 40px; box-shadow: 0 24px 80px rgba(15, 23, 42, 0.12); }
.auth-header { text-align: center; margin-bottom: 32px; }
.auth-logo { width: 56px; height: 56px; background: linear-gradient(135deg, var(--primary), #4f46e5); color: #fff; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 28px; margin: 0 auto 16px; }
.auth-header h1 { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
.auth-header p { font-size: 14px; color: var(--text-secondary); line-height: 1.6; }
.auth-footer { text-align: center; font-size: 14px; color: var(--text-secondary); }
.auth-footer a { color: var(--primary); font-weight: 600; }
</style>
