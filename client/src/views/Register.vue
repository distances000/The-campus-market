<template>
    <div class="auth-page">
        <div class="auth-card">
            <div class="auth-header">
                <div class="auth-logo">C</div>
                <h1>创建账号</h1>
                <p>注册后即可发布商品、收藏和聊天</p>
            </div>

            <el-form :model="form" :rules="rules" ref="formRef" size="large" @submit.prevent="handleRegister">
                <el-form-item prop="username">
                    <el-input v-model="form.username" placeholder="请输入用户名" :prefix-icon="User" autocomplete="username" />
                </el-form-item>
                <el-form-item prop="nickname">
                    <el-input v-model="form.nickname" placeholder="请输入昵称" :prefix-icon="Edit" autocomplete="nickname" />
                </el-form-item>
                <el-form-item prop="phone">
                    <el-input
                        v-model="form.phone"
                        placeholder="请输入手机号"
                        maxlength="11"
                        autocomplete="tel"
                        @blur="handlePhoneBlur"
                    />
                </el-form-item>
                <el-form-item prop="phoneCode">
                    <div class="code-row">
                        <el-input
                            v-model="form.phoneCode"
                            placeholder="请输入短信验证码"
                            maxlength="6"
                            autocomplete="one-time-code"
                        />
                        <el-button
                            class="code-button"
                            :loading="sendingCode"
                            :disabled="sendCodeDisabled"
                            @click="handleSendCode"
                        >
                            {{ codeButtonText }}
                        </el-button>
                    </div>
                    <div class="form-tip">验证码会发送到你填写的手机号，5 分钟内有效。</div>
                </el-form-item>
                <el-form-item prop="password">
                    <el-input
                        v-model="form.password"
                        type="password"
                        placeholder="请输入密码（至少6位）"
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
                <el-form-item>
                    <el-button type="primary" native-type="submit" :loading="loading" style="width: 100%">
                        注册并登录
                    </el-button>
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
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "../utils/message";
import { useUserStore } from "../stores/user";
import { register as regApi, sendRegisterPhoneCode } from "../api/auth";
import { User, Edit, Lock } from "../components/element-icons";

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();

const formRef = ref(null);
const loading = ref(false);
const sendingCode = ref(false);
const codeCountdown = ref(0);
const lastSentPhone = ref("");

let countdownTimer = null;

const form = reactive({
    username: "",
    nickname: "",
    phone: "",
    phoneCode: "",
    password: "",
    passwordConfirm: ""
});

const redirectTo = computed(() => typeof route.query.redirect === "string" ? route.query.redirect : "/home");
const loginLink = computed(() => redirectTo.value ? { path: "/login", query: { redirect: redirectTo.value } } : "/login");
const sendCodeDisabled = computed(() => !isPhoneReady() || sendingCode.value || codeCountdown.value > 0);
const codeButtonText = computed(() => {
    if (sendingCode.value) {
        return "发送中";
    }
    if (codeCountdown.value > 0) {
        return `${codeCountdown.value}s 后重发`;
    }
    return lastSentPhone.value ? "重新发送" : "发送验证码";
});

function validatePhone(rule, value, callback) {
    const phone = String(value || "").trim();
    if (!phone) {
        callback(new Error("请输入手机号"));
        return;
    }
    if (!/^1\d{10}$/.test(phone)) {
        callback(new Error("请输入正确的 11 位手机号"));
        return;
    }
    callback();
}

function validatePhoneCode(rule, value, callback) {
    const code = String(value || "").trim();
    if (!code) {
        callback(new Error("请输入短信验证码"));
        return;
    }
    if (!/^\d{6}$/.test(code)) {
        callback(new Error("请输入 6 位短信验证码"));
        return;
    }
    callback();
}

const rules = {
    username: [{ required: true, message: "请输入用户名", trigger: "blur" }],
    phone: [{ required: true, validator: validatePhone, trigger: "blur" }],
    phoneCode: [{ required: true, validator: validatePhoneCode, trigger: "blur" }],
    password: [
        { required: true, message: "请输入密码", trigger: "blur" },
        { validator: (rule, value, callback) => { if ((value || "").length < 6) callback(new Error("密码至少 6 位")); else callback(); }, trigger: "blur" }
    ],
    passwordConfirm: [
        { required: true, message: "请再次输入密码", trigger: "blur" },
        { validator: (rule, value, callback) => { if (value !== form.password) callback(new Error("两次输入的密码不一致")); else callback(); }, trigger: "blur" }
    ]
};

function getPhone() {
    return String(form.phone || "").trim();
}

function isPhoneReady() {
    return /^1\d{10}$/.test(getPhone());
}

function clearCountdown() {
    if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
    }
}

function startCountdown() {
    clearCountdown();
    const ttl = Number.parseInt(import.meta.env.VITE_SMS_CODE_COOLDOWN_SECONDS || "60", 10);
    codeCountdown.value = Number.isFinite(ttl) && ttl > 0 ? ttl : 60;
    countdownTimer = setInterval(() => {
        if (codeCountdown.value <= 1) {
            codeCountdown.value = 0;
            clearCountdown();
            return;
        }
        codeCountdown.value -= 1;
    }, 1000);
}

async function handleSendCode() {
    const phone = getPhone();
    if (!isPhoneReady()) {
        ElMessage.warning("请输入正确的 11 位手机号");
        return;
    }
    if (sendingCode.value || codeCountdown.value > 0) {
        return;
    }

    sendingCode.value = true;
    try {
        await sendRegisterPhoneCode(phone);
        lastSentPhone.value = phone;
        form.phoneCode = "";
        startCountdown();
        ElMessage.success("验证码已发送");
    } catch {
        // 短信接口的错误提示由统一拦截器处理
    } finally {
        sendingCode.value = false;
    }
}

function handlePhoneBlur() {
    const phone = getPhone();
    if (isPhoneReady() && phone !== lastSentPhone.value) {
        handleSendCode();
    }
}

async function handleRegister() {
    const valid = await formRef.value.validate().catch(() => false);
    if (!valid) {
        return;
    }

    loading.value = true;
    try {
        const r = await regApi(
            form.username,
            form.password,
            form.nickname || form.username,
            getPhone(),
            String(form.phoneCode || "").trim()
        );
        userStore.setAuth(r.data.token, r.data.user);
        userStore.authInitialized = true;
        ElMessage.success("注册成功");
        await router.replace(redirectTo.value || "/home");
    } finally {
        loading.value = false;
    }
}

watch(() => form.phone, (next, prev) => {
    const nextPhone = String(next || "").trim();
    const prevPhone = String(prev || "").trim();
    if (nextPhone === prevPhone) {
        return;
    }

    if (form.phoneCode) {
        form.phoneCode = "";
    }

    if (lastSentPhone.value && nextPhone !== lastSentPhone.value) {
        lastSentPhone.value = "";
        codeCountdown.value = 0;
        clearCountdown();
    }
});

onMounted(() => {
    userStore.ensureAuth().then(() => {
        if (!userStore.isLoggedIn) {
            return;
        }
        router.replace(redirectTo.value || "/home");
    });
});

onBeforeUnmount(() => {
    clearCountdown();
});
</script>

<style scoped>
.auth-page {
    min-height: var(--app-screen-height);
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #eef2ff 0%, #f8fafc 45%, #ffffff 100%);
    padding: 20px;
}

.auth-card {
    width: 400px;
    max-width: 100%;
    background: var(--bg-primary);
    border-radius: 20px;
    padding: 40px;
    box-shadow: 0 24px 80px rgba(15, 23, 42, 0.12);
}

.auth-header {
    text-align: center;
    margin-bottom: 32px;
}

.auth-logo {
    width: 56px;
    height: 56px;
    background: linear-gradient(135deg, var(--primary), #4f46e5);
    color: #fff;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 28px;
    margin: 0 auto 16px;
}

.auth-header h1 {
    font-size: 22px;
    font-weight: 700;
    margin-bottom: 8px;
}

.auth-header p {
    font-size: 14px;
    color: var(--text-secondary);
    line-height: 1.6;
}

.auth-footer {
    text-align: center;
    font-size: 14px;
    color: var(--text-secondary);
}

.auth-footer a {
    color: var(--primary);
    font-weight: 600;
}

.code-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;
    align-items: start;
    width: 100%;
}

.code-button {
    white-space: nowrap;
}

.form-tip {
    margin-top: 8px;
    font-size: 12px;
    line-height: 1.6;
    color: var(--text-secondary);
}
</style>
