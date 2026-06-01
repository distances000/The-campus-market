<template>
    <div class="auth-page forgot-page">
        <div class="forgot-shell">
            <section class="hero-card">
                <div class="hero-copy">
                    <div class="hero-eyebrow">账号安全</div>
                    <h1>找回密码</h1>
                    <p>当前项目没有短信和邮箱能力，找回密码走人工审核。你可以提交申请单，管理员核验后会重置一个临时密码，首次登录后系统会强制你修改密码。</p>
                </div>
                <div class="hero-steps">
                    <div class="step-item" v-for="step in steps" :key="step.title">
                        <strong>{{ step.title }}</strong>
                        <span>{{ step.description }}</span>
                    </div>
                </div>
            </section>

            <div class="forgot-grid">
                <section class="form-card">
                    <div class="section-head">
                        <h2>提交找回申请</h2>
                        <p>请填写注册用户名和已绑定手机号。管理员会按照申请顺序人工处理。</p>
                    </div>

                    <el-form ref="requestFormRef" :model="requestForm" :rules="requestRules" label-position="top" size="large">
                        <el-form-item label="用户名" prop="username">
                            <el-input v-model="requestForm.username" placeholder="请输入注册用户名" autocomplete="username" />
                        </el-form-item>
                        <el-form-item label="绑定手机号" prop="phone">
                            <el-input v-model="requestForm.phone" maxlength="11" placeholder="请输入 11 位手机号" autocomplete="tel" />
                        </el-form-item>
                        <el-form-item label="情况说明" prop="reason">
                            <el-input
                                v-model="requestForm.reason"
                                type="textarea"
                                :rows="4"
                                maxlength="500"
                                show-word-limit
                                placeholder="例如：手机丢失、长时间未登录、当前设备无法取回原密码"
                            />
                        </el-form-item>
                        <el-button type="primary" :loading="submitting" style="width: 100%" @click="handleSubmitRequest">
                            提交找回申请
                        </el-button>
                    </el-form>

                    <div v-if="latestRequest" class="result-card">
                        <div class="result-head">
                            <span class="result-label">最新申请</span>
                            <el-tag :type="getStatusMeta(latestRequest.status).type">
                                {{ getStatusMeta(latestRequest.status).label }}
                            </el-tag>
                        </div>
                        <p>申请编号：#{{ latestRequest.id }}</p>
                        <p>提交时间：{{ formatTime(latestRequest.created_at) }}</p>
                        <p v-if="latestRequest.resolution_note">处理说明：{{ latestRequest.resolution_note }}</p>
                    </div>
                </section>

                <section class="form-card">
                    <div class="section-head">
                        <h2>查询处理状态</h2>
                        <p>如果你已经提交过申请，可以在这里查询当前处理进度。</p>
                    </div>

                    <el-form ref="statusFormRef" :model="statusForm" :rules="statusRules" label-position="top" size="large">
                        <el-form-item label="用户名" prop="username">
                            <el-input v-model="statusForm.username" placeholder="请输入注册用户名" autocomplete="username" />
                        </el-form-item>
                        <el-form-item label="绑定手机号" prop="phone">
                            <el-input v-model="statusForm.phone" maxlength="11" placeholder="请输入 11 位手机号" autocomplete="tel" />
                        </el-form-item>
                        <el-button plain :loading="querying" style="width: 100%" @click="handleQueryStatus">
                            查询最新进度
                        </el-button>
                    </el-form>

                    <div v-if="statusResult" class="status-card">
                        <div class="result-head">
                            <span class="result-label">当前进度</span>
                            <el-tag :type="getStatusMeta(statusResult.status).type">
                                {{ getStatusMeta(statusResult.status).label }}
                            </el-tag>
                        </div>
                        <p>申请编号：#{{ statusResult.id }}</p>
                        <p>提交时间：{{ formatTime(statusResult.created_at) }}</p>
                        <p v-if="statusResult.handled_at">处理时间：{{ formatTime(statusResult.handled_at) }}</p>
                        <p v-if="statusResult.handled_by_name">处理人：{{ statusResult.handled_by_name }}</p>
                        <p v-if="statusResult.resolution_note">处理说明：{{ statusResult.resolution_note }}</p>
                    </div>

                    <div class="auth-link-row">
                        <router-link class="inline-link" :to="loginLink">返回登录</router-link>
                        <router-link class="inline-link" :to="registerLink">没有账号？去注册</router-link>
                    </div>
                </section>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed, reactive, ref } from "vue";
import { useRoute } from "vue-router";
import { ElMessage } from "../utils/message";
import { createPasswordResetRequest, getPasswordResetStatus } from "../api/auth";

const route = useRoute();

const requestFormRef = ref(null);
const statusFormRef = ref(null);
const submitting = ref(false);
const querying = ref(false);
const latestRequest = ref(null);
const statusResult = ref(null);

const requestForm = reactive({
    username: "",
    phone: "",
    reason: ""
});

const statusForm = reactive({
    username: "",
    phone: ""
});

const redirectTo = computed(() => (typeof route.query.redirect === "string" ? route.query.redirect : "/home"));
const loginLink = computed(() => ({ path: "/login", query: { redirect: redirectTo.value } }));
const registerLink = computed(() => ({ path: "/register", query: { redirect: redirectTo.value } }));

const steps = [
    { title: "1. 提交申请", description: "填写用户名、绑定手机号和情况说明。" },
    { title: "2. 人工核验", description: "管理员按申请单核对身份信息并确认风险。" },
    { title: "3. 重置临时密码", description: "审核通过后管理员设置临时密码并更新处理说明。" },
    { title: "4. 首次登录改密", description: "使用临时密码登录后，系统会强制你立即修改密码。" }
];

function validatePhone(rule, value, callback) {
    if (!/^1\d{10}$/.test(String(value || "").trim())) {
        callback(new Error("请输入正确的 11 位手机号"));
        return;
    }
    callback();
}

const requestRules = {
    username: [{ required: true, message: "请输入用户名", trigger: "blur" }],
    phone: [{ required: true, validator: validatePhone, trigger: "blur" }],
    reason: [
        {
            validator: (rule, value, callback) => {
                if (String(value || "").trim().length > 500) {
                    callback(new Error("情况说明不能超过 500 字"));
                    return;
                }
                callback();
            },
            trigger: "blur"
        }
    ]
};

const statusRules = {
    username: [{ required: true, message: "请输入用户名", trigger: "blur" }],
    phone: [{ required: true, validator: validatePhone, trigger: "blur" }]
};

function getStatusMeta(status) {
    const map = {
        pending: { label: "待处理", type: "warning" },
        reviewing: { label: "审核中", type: "primary" },
        resolved: { label: "已通过", type: "success" },
        rejected: { label: "未通过", type: "info" }
    };
    return map[status] || { label: status || "未知", type: "info" };
}

function formatTime(value) {
    if (!value) {
        return "暂无";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return String(value);
    }
    return date.toLocaleString("zh-CN");
}

async function handleSubmitRequest() {
    const valid = await requestFormRef.value.validate().catch(() => false);
    if (!valid) {
        return;
    }

    submitting.value = true;
    try {
        const response = await createPasswordResetRequest({
            username: requestForm.username.trim(),
            phone: requestForm.phone.trim(),
            reason: requestForm.reason.trim()
        });
        latestRequest.value = response.data;
        statusResult.value = response.data;
        statusForm.username = requestForm.username;
        statusForm.phone = requestForm.phone;
        ElMessage.success("找回申请已提交");
    } finally {
        submitting.value = false;
    }
}

async function handleQueryStatus() {
    const valid = await statusFormRef.value.validate().catch(() => false);
    if (!valid) {
        return;
    }

    querying.value = true;
    try {
        const response = await getPasswordResetStatus({
            username: statusForm.username.trim(),
            phone: statusForm.phone.trim()
        });
        statusResult.value = response.data;
    } finally {
        querying.value = false;
    }
}
</script>

<style scoped>
.forgot-page {
    min-height: var(--app-screen-height);
    padding: 24px;
    background:
        radial-gradient(circle at top left, rgba(214, 227, 255, 0.72), transparent 28%),
        linear-gradient(180deg, rgba(246, 248, 255, 0.96), rgba(255, 255, 255, 0.98));
}

.forgot-shell {
    max-width: 1120px;
    margin: 0 auto;
}

.hero-card,
.form-card {
    border-radius: 32px;
    border: 1px solid rgba(194, 199, 208, 0.22);
    background: rgba(255, 255, 255, 0.92);
    box-shadow: var(--shadow-lg);
}

.hero-card {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
    gap: 20px;
    padding: 28px;
    margin-bottom: 20px;
}

.hero-eyebrow {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--primary);
}

.hero-copy h1 {
    margin-top: 8px;
    font-size: 34px;
    font-weight: 800;
    letter-spacing: -0.04em;
}

.hero-copy p {
    margin-top: 12px;
    max-width: 620px;
    font-size: 14px;
    line-height: 1.8;
    color: var(--text-secondary);
}

.hero-steps {
    display: grid;
    gap: 12px;
}

.step-item {
    display: grid;
    gap: 6px;
    padding: 16px 18px;
    border-radius: 24px;
    background: rgba(240, 244, 255, 0.72);
    border: 1px solid rgba(194, 199, 208, 0.18);
}

.step-item strong {
    font-size: 14px;
    color: var(--text-primary);
}

.step-item span {
    font-size: 12px;
    line-height: 1.7;
    color: var(--text-tertiary);
}

.forgot-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 20px;
}

.form-card {
    padding: 24px;
}

.section-head {
    margin-bottom: 18px;
}

.section-head h2 {
    font-size: 22px;
    font-weight: 800;
}

.section-head p {
    margin-top: 8px;
    font-size: 13px;
    line-height: 1.7;
    color: var(--text-tertiary);
}

.result-card,
.status-card {
    margin-top: 16px;
    padding: 16px 18px;
    border-radius: 24px;
    background: rgba(242, 245, 251, 0.92);
    border: 1px solid rgba(194, 199, 208, 0.18);
}

.result-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
}

.result-label {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-primary);
}

.result-card p,
.status-card p {
    margin-top: 8px;
    font-size: 13px;
    line-height: 1.7;
    color: var(--text-secondary);
}

.auth-link-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-top: 18px;
}

.inline-link {
    color: var(--primary);
    font-size: 13px;
    font-weight: 700;
}

@media (max-width: 900px) {
    .hero-card,
    .forgot-grid {
        grid-template-columns: 1fr;
    }
}

@media (max-width: 640px) {
    .forgot-page {
        padding: 12px;
    }

    .hero-card,
    .form-card {
        border-radius: 24px;
    }

    .hero-copy h1 {
        font-size: 28px;
    }

    .auth-link-row {
        flex-direction: column;
    }
}
</style>
