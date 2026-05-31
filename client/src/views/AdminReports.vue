<template>
    <div class="admin-page">
        <div class="page-container admin-container">
            <section class="admin-hero">
                <div class="hero-copy">
                    <div class="eyebrow">内容治理</div>
                    <h1>举报管理</h1>
                    <p>处理商品和帖子举报，更新处理状态，并在需要时执行下架商品或删除帖子。</p>
                </div>
                <div class="hero-actions">
                    <el-button plain @click="goPasswordResets">查看密码重置</el-button>
                    <el-button type="primary" :loading="loading" @click="fetchReports">刷新列表</el-button>
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
                    <el-select v-model="filters.target_type" placeholder="举报类型" clearable>
                        <el-option v-for="item in targetTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
                    </el-select>
                    <el-input
                        v-model="filters.keyword"
                        placeholder="搜索标题、摘要或举报人"
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
                <el-table v-loading="loading" :data="reports" row-key="id" highlight-current-row @row-click="openDetail">
                    <el-table-column prop="id" label="ID" width="86" />
                    <el-table-column label="目标" min-width="220">
                        <template #default="{ row }">
                            <div class="table-title">
                                <span>{{ row.snapshot_title || "未命名目标" }}</span>
                                <el-tag size="small" :type="row.target_type === 'product' ? 'success' : 'info'">
                                    {{ targetTypeLabel(row.target_type) }}
                                </el-tag>
                            </div>
                            <div class="table-subtitle">{{ row.snapshot_excerpt || "暂无摘要" }}</div>
                        </template>
                    </el-table-column>
                    <el-table-column label="举报人" width="150">
                        <template #default="{ row }">{{ row.reporter_name || "未知用户" }}</template>
                    </el-table-column>
                    <el-table-column label="原因" width="120">
                        <template #default="{ row }">{{ reasonLabel(row.reason) }}</template>
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

                <el-empty v-if="!loading && !reports.length" description="暂无举报记录" />
            </section>
        </div>

        <el-drawer v-model="drawerVisible" size="520px" :destroy-on-close="true" title="举报详情">
            <template v-if="detailReport">
                <section class="drawer-block">
                    <div class="drawer-title-row">
                        <h3>{{ detailReport.snapshot_title || "未命名目标" }}</h3>
                        <el-tag :type="statusMeta(detailReport.status).type" size="small">
                            {{ statusMeta(detailReport.status).label }}
                        </el-tag>
                    </div>
                    <div class="drawer-meta">
                        <span>举报人：{{ detailReport.reporter_name || "未知用户" }}</span>
                        <span>目标类型：{{ targetTypeLabel(detailReport.target_type) }}</span>
                        <span>目标归属：{{ detailReport.target_owner_name || "未知" }}</span>
                        <span>创建时间：{{ formatTime(detailReport.created_at) }}</span>
                    </div>
                    <p class="drawer-excerpt">{{ detailReport.snapshot_excerpt || "暂无摘要" }}</p>
                </section>

                <section class="drawer-block">
                    <h4>举报说明</h4>
                    <p class="drawer-text">{{ detailReport.description || "未填写补充说明" }}</p>
                </section>

                <section class="drawer-block">
                    <h4>处理信息</h4>
                    <div class="drawer-meta">
                        <span>当前动作：{{ actionLabel(detailReport.handled_action) }}</span>
                        <span>处理人：{{ detailReport.handled_by_name || "未处理" }}</span>
                        <span>处理时间：{{ detailReport.handled_at ? formatTime(detailReport.handled_at) : "未处理" }}</span>
                    </div>
                    <p class="drawer-text">{{ detailReport.resolution_note || "暂无处理说明" }}</p>
                </section>

                <section class="drawer-block">
                    <h4>处理举报</h4>
                    <el-form :model="processForm" label-position="top">
                        <el-form-item label="处理状态">
                            <el-select v-model="processForm.status" style="width: 100%">
                                <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
                            </el-select>
                        </el-form-item>
                        <el-form-item v-if="processForm.status === 'resolved'" label="执行动作">
                            <el-select v-model="processForm.handled_action" style="width: 100%">
                                <el-option v-for="item in actionOptions" :key="item.value" :label="item.label" :value="item.value" />
                            </el-select>
                        </el-form-item>
                        <el-form-item label="处理说明">
                            <el-input
                                v-model="processForm.resolution_note"
                                type="textarea"
                                :rows="4"
                                maxlength="500"
                                show-word-limit
                                placeholder="说明本次处理的结论"
                            />
                        </el-form-item>
                    </el-form>
                    <div class="drawer-actions">
                        <el-button @click="drawerVisible = false">关闭</el-button>
                        <el-button type="primary" :loading="saving" @click="submitReport">保存处理</el-button>
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
import { getAdminReport, getAdminReports, updateAdminReport } from "../api/admin";
import { REPORT_REASON_MAP } from "../utils/report";

const router = useRouter();

const reports = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const loading = ref(false);
const saving = ref(false);
const drawerVisible = ref(false);
const detailReport = ref(null);

const filters = reactive({
    status: "",
    target_type: "",
    keyword: ""
});

const processForm = reactive({
    status: "reviewing",
    handled_action: "none",
    resolution_note: ""
});

const statusOptions = [
    { label: "待处理", value: "pending" },
    { label: "处理中", value: "reviewing" },
    { label: "已处理", value: "resolved" },
    { label: "已驳回", value: "rejected" }
];

const targetTypeOptions = [
    { label: "商品", value: "product" },
    { label: "帖子", value: "post" }
];

const actionOptions = [
    { label: "不执行动作", value: "none" },
    { label: "下架商品", value: "hide_product" },
    { label: "删除帖子", value: "delete_post" }
];

function statusMeta(status) {
    const map = {
        pending: { label: "待处理", type: "warning" },
        reviewing: { label: "处理中", type: "primary" },
        resolved: { label: "已处理", type: "success" },
        rejected: { label: "已驳回", type: "info" }
    };
    return map[status] || { label: status || "未知", type: "info" };
}

function reasonLabel(reason) {
    return REPORT_REASON_MAP[reason] || reason || "未知";
}

function targetTypeLabel(targetType) {
    const map = {
        product: "商品",
        post: "帖子"
    };
    return map[targetType] || targetType || "未知";
}

function actionLabel(action) {
    const map = {
        none: "不执行动作",
        hide_product: "下架商品",
        delete_post: "删除帖子"
    };
    return map[action] || action || "未知";
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
        { label: "当前页举报", value: reports.value.length },
        { label: "待处理", value: reports.value.filter((item) => item.status === "pending").length },
        { label: "处理中", value: reports.value.filter((item) => item.status === "reviewing").length },
        { label: "已完成", value: reports.value.filter((item) => item.status === "resolved" || item.status === "rejected").length }
    ];
});

function syncProcessForm(report) {
    processForm.status = report.status || "reviewing";
    processForm.handled_action = report.handled_action || "none";
    processForm.resolution_note = report.resolution_note || "";
    if (processForm.status !== "resolved") {
        processForm.handled_action = "none";
    }
}

async function fetchReports() {
    loading.value = true;
    try {
        const response = await getAdminReports({
            page: page.value,
            page_size: pageSize.value,
            status: filters.status || undefined,
            target_type: filters.target_type || undefined,
            keyword: filters.keyword || undefined
        });
        reports.value = response.data.list || [];
        total.value = response.data.total || 0;
    } catch {
        reports.value = [];
        total.value = 0;
    } finally {
        loading.value = false;
    }
}

function handleSearch() {
    page.value = 1;
    fetchReports();
}

function resetFilters() {
    filters.status = "";
    filters.target_type = "";
    filters.keyword = "";
    page.value = 1;
    fetchReports();
}

function handlePageSizeChange(nextPageSize) {
    pageSize.value = nextPageSize;
    page.value = 1;
    fetchReports();
}

async function openDetail(report) {
    try {
        const response = await getAdminReport(report.id);
        detailReport.value = response.data;
        syncProcessForm(response.data);
        drawerVisible.value = true;
    } catch {
        ElMessage.error("加载举报详情失败");
    }
}

async function submitReport() {
    if (!detailReport.value) {
        return;
    }
    if ((processForm.status === "resolved" || processForm.status === "rejected") && !processForm.resolution_note.trim()) {
        ElMessage.warning("处理完成时必须填写处理说明");
        return;
    }

    saving.value = true;
    try {
        const response = await updateAdminReport(detailReport.value.id, {
            status: processForm.status,
            handled_action: processForm.status === "resolved" ? processForm.handled_action : "none",
            resolution_note: processForm.resolution_note
        });
        detailReport.value = response.data;
        syncProcessForm(response.data);
        reports.value = reports.value.map((item) => (item.id === response.data.id ? response.data : item));
        ElMessage.success("举报处理结果已更新");
        await fetchReports();
    } finally {
        saving.value = false;
    }
}

function goPasswordResets() {
    router.push("/admin/password-resets");
}

watch(page, () => {
    fetchReports();
});

watch(() => processForm.status, (status) => {
    if (status !== "resolved") {
        processForm.handled_action = "none";
    }
});

onMounted(fetchReports);
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
    max-width: 620px;
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
    grid-template-columns: 180px 180px 1fr auto;
    gap: 12px;
    align-items: center;
}

.filter-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
}

.table-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
}

.table-subtitle {
    margin-top: 4px;
    font-size: 12px;
    color: var(--text-tertiary);
    line-height: 1.5;
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

.drawer-excerpt,
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
