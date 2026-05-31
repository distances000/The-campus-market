<template>
    <div class="auth-page">
        <div class="auth-card">
            <div class="auth-header">
                <div class="auth-logo">C</div>
                <h1>欢迎回来</h1>
                <p>登录后继续管理你的商品、收藏、聊天和订单。</p>
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
                <div class="auth-actions-row">
                    <router-link class="inline-link" :to="forgotPasswordLink">忘记密码</router-link>
                    <span class="hint-text">支持管理员人工重置后强制改密</span>
                </div>
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
const registerLink = computed(() => ({ path: "/register", query: { redirect: redirectTo.value } }));
const forgotPasswordLink = computed(() => ({ path: "/forgot-password", query: { redirect: redirectTo.value } }));

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
        const response = await loginApi(form.username.trim(), form.password);
        userStore.setAuth(response.data.token, response.data.user);
        userStore.authInitialized = true;

        if (response.data.user?.must_change_password) {
            ElMessage.warning("当前账号使用了管理员重置密码，请先修改密码");
            await router.replace({ path: "/profile", query: { changePassword: "1" } });
            return;
        }

        ElMessage.success("登录成功");
        await router.replace(redirectTo.value || "/home");
    } finally {
        loading.value = false;
    }
}

onMounted(() => {
    userStore.ensureAuth().then(() => {
        if (!userStore.isLoggedIn) {
            return;
        }
        if (userStore.user?.must_change_password) {
            router.replace({ path: "/profile", query: { changePassword: "1" } });
            return;
        }
        router.replace(redirectTo.value || "/home");
    });
});
</script>

<style scoped>
.auth-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background:
        radial-gradient(circle at top left, rgba(214, 227, 255, 0.72), transparent 28%),
        linear-gradient(135deg, rgba(238, 242, 255, 0.96) 0%, rgba(248, 250, 252, 0.98) 48%, rgba(255, 255, 255, 1) 100%);
}

.auth-card {
    width: 420px;
    max-width: 100%;
    padding: 36px;
    border-radius: 32px;
    background: rgba(255, 255, 255, 0.94);
    border: 1px solid rgba(194, 199, 208, 0.22);
    box-shadow: var(--shadow-lg);
}

.auth-header {
    text-align: center;
    margin-bottom: 28px;
}

.auth-logo {
    width: 56px;
    height: 56px;
    margin: 0 auto 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 18px;
    background: linear-gradient(135deg, var(--primary), #6f7fd6);
    color: #fff;
    font-size: 28px;
    font-weight: 800;
    box-shadow: var(--shadow-md);
}

.auth-header h1 {
    font-size: 24px;
    font-weight: 800;
    letter-spacing: -0.03em;
}

.auth-header p {
    margin-top: 8px;
    font-size: 14px;
    line-height: 1.7;
    color: var(--text-secondary);
}

.auth-actions-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin: -4px 0 16px;
}

.inline-link {
    font-size: 13px;
    font-weight: 700;
    color: var(--primary);
}

.hint-text {
    font-size: 12px;
    color: var(--text-tertiary);
}

.auth-footer {
    text-align: center;
    font-size: 14px;
    color: var(--text-secondary);
}

.auth-footer a {
    color: var(--primary);
    font-weight: 700;
}

@media (max-width: 640px) {
    .auth-page {
        padding: 12px;
    }

    .auth-card {
        padding: 24px;
        border-radius: 24px;
    }

    .auth-actions-row {
        flex-direction: column;
        align-items: flex-start;
    }
}
</style>
