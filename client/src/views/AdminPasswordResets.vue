<template>
    <div class="admin-page">
        <div class="page-container admin-container">
            <section class="admin-hero">
                <div class="hero-copy">
                    <div class="eyebrow">账号管理</div>
                    <h1>密码重置申请</h1>
                    <p>集中处理用户的找回密码申请。审核通过后，请设置一个临时密码，并提醒用户首次登录后立即修改密码。</p>
                </div>
                <div class="hero-actions">
                    <el-button plain @click="goReports">查看举报管理</el-button>
                    <el-button type="primary" :loading="loading" @click="fetchRequests">刷新列表</el-button>
                </div>
            </section>

            <section class="summary-grid">
                <div class="summary-card" v-for="card in summaryCards" :key="card.label">
                    <span class="summary-label">{{ card.label }}</span>
                    <strong class="summary-value">{{ card.value }}</strong>
                </div>
            </section>

            <section class="filter-card">
                <div class="filter-row">
                    <el-select v-model="filters.status" placeholder="处理状态" clearable>
                        <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
                    </el-select>
                    <el-input
                        v-model="filters.keyword"
                        placeholder="搜索用户名、手机号或说明"
                        clearable
                        @keyup.enter="handleSearch"
                    />
                    <div class="filter-actions">
                        <el-button @click="resetFilters">重置</el-button>
                        <el-button type="primary" :loading="loading" @click="handleSearch">筛选</el-button>
                    </div>
                </div>
            </section>

            <section class="table-card">
                <el-table v-loading="loading" :data="requests" row-key="id" highlight-current-row @row-click="openDetail">
                    <el-table-column prop="id" label="ID" width="84" />
                    <el-table-column label="申请人" min-width="220">
                        <template #default="{ row }">
                            <div class="table-title">{{ row.requester_name || row.username_snapshot }}</div>
                            <div class="table-subtitle">用户名：{{ row.username_snapshot }}</div>
                        </template>
                    </el-table-column>
                    <el-table-column label="手机号" width="160">
                        <template #default="{ row }">{{ row.request_phone }}</template>
                    </el-table-column>
                    <el-table-column label="状态" width="120">
                        <template #default="{ row }">
                            <el-tag :type="statusMeta(row.status).type" size="small">
                                {{ statusMeta(row.status).label }}
                            </el-tag>
                        </template>
                    </el-table-column>
                    <el-table-column label="时间" width="170">
                        <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
                    </el-table-column>
                    <el-table-column label="操作" width="110" fixed="right">
                        <template #default="{ row }">
                            <el-button text type="primary" @click.stop="openDetail(row)">处理</el-button>
                        </template>
                    </el-table-column>
                </el-table>

                <div class="pager" v-if="total > 0">
                    <el-pagination
                        v-model:current-page="page"
                        v-model:page-size="pageSize"
                        :page-sizes="[10, 20, 50]"
                        layout="total, sizes, prev, pager, next, jumper"
                        :total="total"
                        @size-change="handlePageSizeChange"
                    />
                </div>

                <el-empty v-if="!loading && !requests.length" description="暂无密码重置申请" />
            </section>
        </div>

        <el-drawer v-model="drawerVisible" size="540px" :destroy-on-close="true" title="处理密码重置申请">
            <template v-if="detailRequest">
                <section class="drawer-block">
                    <div class="drawer-title-row">
                        <h3>#{{ detailRequest.id }} {{ detailRequest.requester_name || detailRequest.username_snapshot }}</h3>
                        <el-tag :type="statusMeta(detailRequest.status).type" size="small">
                            {{ statusMeta(detailRequest.status).label }}
                        </el-tag>
                    </div>
                    <div class="drawer-meta">
                        <span>用户名：{{ detailRequest.username_snapshot }}</span>
                        <span>申请手机号：{{ detailRequest.request_phone }}</span>
                        <span>绑定手机号：{{ detailRequest.bound_phone || "未绑定" }}</span>
                        <span>提交时间：{{ formatTime(detailRequest.created_at) }}</span>
                    </div>
                    <p class="drawer-text">{{ detailRequest.reason || "未填写情况说明" }}</p>
                </section>

                <section class="drawer-block">
                    <h4>处理说明</h4>
                    <el-form :model="processForm" label-position="top">
                        <el-form-item label="处理状态">
                            <el-select v-model="processForm.status" style="width: 100%">
                                <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
                            </el-select>
                        </el-form-item>
                        <el-form-item v-if="processForm.status === 'resolved'" label="临时密码">
                            <el-input
                                v-model="processForm.new_password"
                                type="password"
                                show-password
                                autocomplete="new-password"
                                placeholder="请输入至少 6 位的临时密码"
                            />
                        </el-form-item>
                        <el-form-item label="处理说明">
                            <el-input
                                v-model="processForm.resolution_note"
                                type="textarea"
                                :rows="4"
                                maxlength="500"
                                show-word-limit
                                placeholder="例如：已电话核验身份，已重置临时密码，请首次登录后立即修改密码"
                            />
                        </el-form-item>
                    </el-form>
                    <div class="drawer-actions">
                        <el-button @click="drawerVisible = false">关闭</el-button>
                        <el-button type="primary" :loading="saving" @click="submitRequest">保存处理</el-button>
                    </div>
                </section>
            </template>
        </el-drawer>
    </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "../utils/message";
import {
    getAdminPasswordReset,
    getAdminPasswordResets,
    updateAdminPasswordReset
} from "../api/admin";

const router = useRouter();

const requests = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const loading = ref(false);
const saving = ref(false);
const drawerVisible = ref(false);
const detailRequest = ref(null);

const filters = reactive({
    status: "",
    keyword: ""
});

const processForm = reactive({
    status: "reviewing",
    new_password: "",
    resolution_note: ""
});

const statusOptions = [
    { label: "待处理", value: "pending" },
    { label: "审核中", value: "reviewing" },
    { label: "已通过", value: "resolved" },
    { label: "未通过", value: "rejected" }
];

function statusMeta(status) {
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

const summaryCards = computed(() => {
    return [
        { label: "当前页申请", value: requests.value.length },
        { label: "待处理", value: requests.value.filter((item) => item.status === "pending").length },
        { label: "审核中", value: requests.value.filter((item) => item.status === "reviewing").length },
        { label: "已完成", value: requests.value.filter((item) => item.status === "resolved" || item.status === "rejected").length }
    ];
});

function syncProcessForm(record) {
    processForm.status = record.status || "reviewing";
    processForm.new_password = "";
    processForm.resolution_note = record.resolution_note || "";
}

async function fetchRequests() {
    loading.value = true;
    try {
        const response = await getAdminPasswordResets({
            page: page.value,
            page_size: pageSize.value,
            status: filters.status || undefined,
            keyword: filters.keyword || undefined
        });
        requests.value = response.data.list || [];
        total.value = response.data.total || 0;
    } catch {
        requests.value = [];
        total.value = 0;
    } finally {
        loading.value = false;
    }
}

function handleSearch() {
    page.value = 1;
    fetchRequests();
}

function resetFilters() {
    filters.status = "";
    filters.keyword = "";
    page.value = 1;
    fetchRequests();
}

function handlePageSizeChange(nextPageSize) {
    pageSize.value = nextPageSize;
    page.value = 1;
    fetchRequests();
}

async function openDetail(row) {
    try {
        const response = await getAdminPasswordReset(row.id);
        detailRequest.value = response.data;
        syncProcessForm(response.data);
        drawerVisible.value = true;
    } catch {
        ElMessage.error("加载申请详情失败");
    }
}

async function submitRequest() {
    if (!detailRequest.value) {
        return;
    }
    if ((processForm.status === "resolved" || processForm.status === "rejected") && !processForm.resolution_note.trim()) {
        ElMessage.warning("处理完成时必须填写处理说明");
        return;
    }
    if (processForm.status === "resolved" && processForm.new_password.trim().length < 6) {
        ElMessage.warning("请设置至少 6 位的临时密码");
        return;
    }

    saving.value = true;
    try {
        const response = await updateAdminPasswordReset(detailRequest.value.id, {
            status: processForm.status,
            resolution_note: processForm.resolution_note.trim(),
            new_password: processForm.status === "resolved" ? processForm.new_password.trim() : undefined
        });
        detailRequest.value = response.data;
        syncProcessForm(response.data);
        requests.value = requests.value.map((item) => (item.id === response.data.id ? { ...item, ...response.data } : item));
        ElMessage.success("密码重置申请已更新");
        await fetchRequests();
    } finally {
        saving.value = false;
    }
}

function goReports() {
    router.push("/admin/reports");
}

watch(page, () => {
    fetchRequests();
});

onMounted(fetchRequests);
</script>

<style scoped>
.admin-page {
    padding-top: 8px;
}

.admin-container {
    max-width: 1180px;
}

.admin-hero {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    padding: 24px;
    margin-bottom: 16px;
    border-radius: 32px;
    border: 1px solid rgba(194, 199, 208, 0.22);
    background:
        radial-gradient(circle at top right, rgba(214, 227, 255, 0.7), transparent 28%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(247, 249, 255, 0.98));
    box-shadow: var(--shadow-lg);
}

.eyebrow {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--primary);
    margin-bottom: 6px;
}

.hero-copy h1 {
    font-size: 30px;
    font-weight: 800;
    letter-spacing: -0.03em;
}

.hero-copy p {
    margin-top: 10px;
    max-width: 680px;
    font-size: 13px;
    line-height: 1.7;
    color: var(--text-tertiary);
}

.hero-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    align-items: flex-start;
}

.summary-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 16px;
}

.summary-card {
    padding: 16px 18px;
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid rgba(194, 199, 208, 0.18);
    box-shadow: var(--shadow);
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.summary-label {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-tertiary);
}

.summary-value {
    font-size: 30px;
    color: var(--primary);
    line-height: 1;
}

.filter-card,
.table-card {
    margin-bottom: 16px;
    padding: 18px;
    border-radius: 28px;
    background: rgba(255, 255, 255, 0.92);
    border: 1px solid rgba(194, 199, 208, 0.18);
    box-shadow: var(--shadow);
}

.filter-row {
    display: grid;
    grid-template-columns: 220px 1fr auto;
    gap: 12px;
    align-items: center;
}

.filter-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
}

.table-title {
    font-weight: 700;
}

.table-subtitle {
    margin-top: 4px;
    font-size: 12px;
    color: var(--text-tertiary);
}

.pager {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
}

.drawer-block {
    margin-bottom: 18px;
    padding-bottom: 18px;
    border-bottom: 1px solid rgba(223, 226, 235, 0.72);
}

.drawer-block:last-child {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
}

.drawer-title-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
}

.drawer-title-row h3 {
    font-size: 18px;
    font-weight: 800;
    line-height: 1.5;
}

.drawer-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 14px;
    margin-top: 10px;
    font-size: 12px;
    color: var(--text-tertiary);
}

.drawer-text {
    margin-top: 12px;
    line-height: 1.7;
    color: var(--text-secondary);
    white-space: pre-wrap;
    word-break: break-word;
}

.drawer-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
    margin-top: 12px;
}

@media (max-width: 960px) {
    .summary-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .filter-row {
        grid-template-columns: 1fr;
    }

    .filter-actions {
        justify-content: stretch;
    }

    .filter-actions :deep(.el-button) {
        flex: 1;
    }

    .admin-hero {
        flex-direction: column;
    }
}

@media (max-width: 640px) {
    .summary-grid {
        grid-template-columns: 1fr;
    }

    .admin-hero,
    .filter-card,
    .table-card {
        border-radius: 24px;
    }

    .drawer-actions {
        flex-direction: column;
    }

    .drawer-actions :deep(.el-button) {
        width: 100%;
    }
}
</style>
