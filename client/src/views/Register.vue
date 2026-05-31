<template>
    <div class="auth-page">
        <div class="auth-card">
            <div class="auth-header">
                <div class="auth-logo">C</div>
                <h1>创建账号</h1>
                <p>注册后即可发布商品、收藏、聊天，并绑定手机号用于找回密码。</p>
            </div>

            <el-form ref="formRef" :model="form" :rules="rules" size="large" @submit.prevent="handleRegister">
                <el-form-item prop="username">
                    <el-input v-model="form.username" placeholder="请输入用户名" :prefix-icon="User" autocomplete="username" />
                </el-form-item>
                <el-form-item prop="nickname">
                    <el-input v-model="form.nickname" placeholder="请输入昵称" :prefix-icon="Edit" autocomplete="nickname" />
                </el-form-item>
                <el-form-item prop="phone">
                    <el-input v-model="form.phone" placeholder="请输入 11 位手机号" maxlength="11" autocomplete="tel" />
                </el-form-item>
                <el-form-item prop="password">
                    <el-input
                        v-model="form.password"
                        type="password"
                        placeholder="请输入密码（至少 6 位）"
                        :prefix-icon="Lock"
                        show-password
                        autocomplete="new-password"
                    />
                </el-form-item>
                <el-form-item prop="passwordConfirm">
                    <el-input
                        v-model="form.passwordConfirm"
                        type="password"
                        placeholder="请再次输入密码"
                        :prefix-icon="Lock"
                        show-password
                        autocomplete="new-password"
                    />
                </el-form-item>
                <div class="auth-hint-card">
                    <strong>手机号会用于找回密码</strong>
                    <span>当前项目的密码找回走管理员人工审核，没有短信验证码和邮箱链路。</span>
                </div>
                <el-form-item>
                    <el-button type="primary" native-type="submit" :loading="loading" style="width: 100%">注册并登录</el-button>
                </el-form-item>
            </el-form>

            <div class="auth-footer">
                已有账号？
                <router-link :to="loginLink">去登录</router-link>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "../utils/message";
import { User, Edit, Lock } from "../components/element-icons";
import { useUserStore } from "../stores/user";
import { register as registerApi } from "../api/auth";

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();

const formRef = ref(null);
const loading = ref(false);
const form = reactive({ username: "", nickname: "", phone: "", password: "", passwordConfirm: "" });

const redirectTo = computed(() => (typeof route.query.redirect === "string" ? route.query.redirect : "/home"));
const loginLink = computed(() => ({ path: "/login", query: { redirect: redirectTo.value } }));

function validatePhone(rule, value, callback) {
    if (!/^1\d{10}$/.test(String(value || "").trim())) {
        callback(new Error("请输入正确的 11 位手机号"));
        return;
    }
    callback();
}

const rules = {
    username: [{ required: true, message: "请输入用户名", trigger: "blur" }],
    nickname: [{ required: true, message: "请输入昵称", trigger: "blur" }],
    phone: [{ required: true, validator: validatePhone, trigger: "blur" }],
    password: [
        { required: true, message: "请输入密码", trigger: "blur" },
        {
            validator: (rule, value, callback) => {
                if ((value || "").length < 6) {
                    callback(new Error("密码至少 6 位"));
                    return;
                }
                callback();
            },
            trigger: "blur"
        }
    ],
    passwordConfirm: [
        { required: true, message: "请再次输入密码", trigger: "blur" },
        {
            validator: (rule, value, callback) => {
                if (value !== form.password) {
                    callback(new Error("两次输入的密码不一致"));
                    return;
                }
                callback();
            },
            trigger: "blur"
        }
    ]
};

async function handleRegister() {
    const valid = await formRef.value.validate().catch(() => false);
    if (!valid) {
        return;
    }

    loading.value = true;
    try {
        const response = await registerApi(
            form.username.trim(),
            form.password,
            form.nickname.trim() || form.username.trim(),
            form.phone.trim()
        );
        userStore.setAuth(response.data.token, response.data.user);
        userStore.authInitialized = true;
        ElMessage.success("注册成功");
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
    width: 440px;
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

.auth-hint-card {
    display: grid;
    gap: 6px;
    margin: -2px 0 16px;
    padding: 14px 16px;
    border-radius: 22px;
    background: rgba(240, 244, 255, 0.84);
    border: 1px solid rgba(194, 199, 208, 0.18);
}

.auth-hint-card strong {
    font-size: 13px;
    color: var(--text-primary);
}

.auth-hint-card span {
    font-size: 12px;
    line-height: 1.7;
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
}
</style>
