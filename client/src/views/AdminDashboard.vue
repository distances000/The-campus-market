<template>
    <div class="admin-dashboard">
        <section class="dashboard-hero">
            <div class="hero-copy">
                <div class="hero-eyebrow">管理概览</div>
                <h2>集中处理举报、风险内容和后台状态</h2>
                <p>
                    这里会优先展示当前最需要处理的举报，以及平台的基础运行数据。
                    先看概览，再进入举报列表执行具体处理。
                </p>
                <div class="hero-actions">
                    <el-button type="primary" :loading="loading" @click="loadDashboard">刷新数据</el-button>
                    <el-button plain @click="goReports">进入违规处理</el-button>
                </div>
            </div>

            <div class="hero-panel">
                <div class="hero-panel-title">当前优先级</div>
                <div class="hero-panel-value">{{ priorityLabel }}</div>
                <div class="hero-panel-desc">{{ priorityDesc }}</div>
            </div>
        </section>

        <section class="metric-grid">
            <article v-for="card in metricCards" :key="card.label" class="metric-card">
                <div class="metric-label">{{ card.label }}</div>
                <div class="metric-value">{{ card.value }}</div>
                <div class="metric-desc">{{ card.description }}</div>
            </article>
        </section>

        <section class="content-grid">
            <article class="panel panel-large">
                <div class="panel-head">
                    <div>
                        <div class="panel-title">最近举报</div>
                        <div class="panel-subtitle">按状态优先排序，处理最前面的待办项</div>
                    </div>
                    <el-button text @click="goReports">查看全部</el-button>
                </div>

                <div v-if="recentReports.length" class="report-list">
                    <button
                        v-for="report in recentReports"
                        :key="report.id"
                        type="button"
                        class="report-item"
                        @click="openReport(report.id)"
                    >
                        <div class="report-main">
                            <div class="report-top">
                                <div class="report-title">{{ report.snapshot_title || "未命名目标" }}</div>
                                <el-tag size="small" :type="getReportStatusMeta(report.status).type">
                                    {{ getReportStatusMeta(report.status).label }}
                                </el-tag>
                            </div>
                            <div class="report-meta">
                                <span>{{ getReportTargetTypeLabel(report.target_type) }}</span>
                                <span>{{ REPORT_REASON_MAP[report.reason] || report.reason }}</span>
                                <span>{{ formatTime(report.created_at) }}</span>
                            </div>
                            <p class="report-excerpt">{{ report.snapshot_excerpt || "暂无摘要" }}</p>
                        </div>
                        <span class="report-arrow">›</span>
                    </button>
                </div>

                <el-empty v-else description="暂无举报记录" />
            </article>

            <article class="panel">
                <div class="panel-head">
                    <div>
                        <div class="panel-title">后台健康度</div>
                        <div class="panel-subtitle">展示基础数据和当前审核节奏</div>
                    </div>
                </div>

                <div class="health-list">
                    <div class="health-item">
                        <span class="health-label">系统管理员</span>
                        <strong class="health-value">{{ stats.users.admins || 0 }}</strong>
                    </div>
                    <div class="health-item">
                        <span class="health-label">在售商品</span>
                        <strong class="health-value">{{ stats.products.active || 0 }}</strong>
                    </div>
                    <div class="health-item">
                        <span class="health-label">帖子总数</span>
                        <strong class="health-value">{{ stats.posts.total || 0 }}</strong>
                    </div>
                    <div class="health-item">
                        <span class="health-label">今日举报</span>
                        <strong class="health-value">{{ stats.reports.today || 0 }}</strong>
                    </div>
                </div>

                <div class="flow-card">
                    <div class="flow-title">建议操作顺序</div>
                    <div class="flow-step">
                        <span class="flow-index">1</span>
                        <span>先处理待处理举报，再处理处理中队列</span>
                    </div>
                    <div class="flow-step">
                        <span class="flow-index">2</span>
                        <span>对违规内容执行下架或删除，并写明说明</span>
                    </div>
                    <div class="flow-step">
                        <span class="flow-index">3</span>
                        <span>处理完后回到概览刷新，确认队列已下降</span>
                    </div>
                </div>
            </article>
        </section>
    </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "../utils/message";
import { getAdminStats } from "../api/admin";
import { getModerationReports } from "../api/moderation";
import { REPORT_REASON_MAP, getReportStatusMeta, getReportTargetTypeLabel } from "../utils/report";

const router = useRouter();

const loading = ref(false);
const recentReports = ref([]);
const stats = reactive({
    reports: {
        total: 0,
        pending: 0,
        reviewing: 0,
        resolved: 0,
        rejected: 0,
        today: 0
    },
    users: {
        total: 0,
        admins: 0
    },
    products: {
        total: 0,
        active: 0,
        inactive: 0,
        sold: 0
    },
    posts: {
        total: 0
    }
});

const metricCards = computed(() => [
    {
        label: "待处理举报",
        value: stats.reports.pending,
        description: "需要优先处理的未读队列"
    },
    {
        label: "处理中举报",
        value: stats.reports.reviewing,
        description: "已经进入审核流程的举报"
    },
    {
        label: "今日新增",
        value: stats.reports.today,
        description: "当天新增的举报数量"
    },
    {
        label: "已处理",
        value: stats.reports.resolved,
        description: "已经做出处理决定的举报"
    },
    {
        label: "已驳回",
        value: stats.reports.rejected,
        description: "判定不成立或无需处理的举报"
    },
    {
        label: "商品总数",
        value: stats.products.total,
        description: "平台当前可见商品规模"
    }
]);

const priorityLabel = computed(() => {
    if (stats.reports.pending > 0) {
        return "待处理优先";
    }
    if (stats.reports.reviewing > 0) {
        return "处理中优先";
    }
    return "当前队列平稳";
});

const priorityDesc = computed(() => {
    if (stats.reports.pending > 0) {
        return `当前还有 ${stats.reports.pending} 条待处理举报，建议优先清理。`;
    }
    if (stats.reports.reviewing > 0) {
        return `当前有 ${stats.reports.reviewing} 条举报处于处理中状态。`;
    }
    return "暂时没有待处理举报，可以检查最近的处理结果。";
});

function applyStats(payload) {
    stats.reports = {
        ...stats.reports,
        ...(payload?.reports || {})
    };
    stats.users = {
        ...stats.users,
        ...(payload?.users || {})
    };
    stats.products = {
        ...stats.products,
        ...(payload?.products || {})
    };
    stats.posts = {
        ...stats.posts,
        ...(payload?.posts || {})
    };
}

function formatTime(value) {
    if (!value) {
        return "";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return String(value);
    }
    return date.toLocaleString("zh-CN");
}

function goReports() {
    router.push("/moderation/reports");
}

function openReport(id) {
    router.push({ path: "/moderation/reports", query: { id } });
}

async function loadDashboard() {
    loading.value = true;
    try {
        const [statsResponse, reportsResponse] = await Promise.all([
            getAdminStats(),
            getModerationReports({ page: 1, page_size: 6 })
        ]);
        applyStats(statsResponse.data);
        recentReports.value = reportsResponse.data.list || [];
    } catch {
        ElMessage.error("加载管理概览失败");
        recentReports.value = [];
    } finally {
        loading.value = false;
    }
}

onMounted(loadDashboard);
</script>

<style scoped>
.admin-dashboard {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.dashboard-hero {
    display: grid;
    grid-template-columns: minmax(0, 1.5fr) minmax(260px, 0.8fr);
    gap: 16px;
    padding: 24px;
    border-radius: 32px;
    background:
        radial-gradient(circle at top right, rgba(214, 227, 255, 0.7), transparent 30%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 255, 0.98));
    border: 1px solid rgba(194, 199, 208, 0.18);
    box-shadow: var(--shadow-lg);
}

.hero-eyebrow {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--primary);
}

.hero-copy h2 {
    margin-top: 10px;
    font-size: 30px;
    font-weight: 800;
    line-height: 1.25;
    letter-spacing: -0.03em;
}

.hero-copy p {
    margin-top: 10px;
    max-width: 640px;
    font-size: 13px;
    line-height: 1.8;
    color: var(--text-secondary);
}

.hero-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 18px;
}

.hero-panel {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 12px;
    padding: 18px;
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.82);
    border: 1px solid rgba(194, 199, 208, 0.18);
}

.hero-panel-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-tertiary);
}

.hero-panel-value {
    font-size: 30px;
    font-weight: 800;
    color: var(--primary);
}

.hero-panel-desc {
    font-size: 13px;
    line-height: 1.7;
    color: var(--text-secondary);
}

.metric-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
}

.metric-card {
    padding: 18px;
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.92);
    border: 1px solid rgba(194, 199, 208, 0.18);
    box-shadow: var(--shadow);
}

.metric-label {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-tertiary);
}

.metric-value {
    margin-top: 10px;
    font-size: 30px;
    font-weight: 800;
    color: var(--text-primary);
}

.metric-desc {
    margin-top: 8px;
    font-size: 12px;
    line-height: 1.6;
    color: var(--text-tertiary);
}

.content-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.85fr);
    gap: 16px;
}

.panel {
    padding: 20px;
    border-radius: 28px;
    background: rgba(255, 255, 255, 0.92);
    border: 1px solid rgba(194, 199, 208, 0.18);
    box-shadow: var(--shadow);
}

.panel-large {
    min-width: 0;
}

.panel-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
}

.panel-title {
    font-size: 18px;
    font-weight: 800;
}

.panel-subtitle {
    margin-top: 6px;
    font-size: 12px;
    line-height: 1.6;
    color: var(--text-tertiary);
}

.report-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.report-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    width: 100%;
    padding: 14px 16px;
    border: 1px solid rgba(194, 199, 208, 0.18);
    border-radius: 22px;
    background: rgba(240, 245, 255, 0.4);
    text-align: left;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
}

.report-item:hover {
    background: rgba(240, 245, 255, 0.9);
    box-shadow: var(--shadow-md);
    transform: translateY(-1px);
}

.report-main {
    min-width: 0;
    flex: 1;
}

.report-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
}

.report-title {
    font-size: 15px;
    font-weight: 800;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.report-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
    margin-top: 8px;
    font-size: 12px;
    color: var(--text-tertiary);
}

.report-excerpt {
    margin-top: 8px;
    font-size: 13px;
    line-height: 1.6;
    color: var(--text-secondary);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.report-arrow {
    flex-shrink: 0;
    font-size: 28px;
    line-height: 1;
    color: var(--text-tertiary);
}

.health-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
}

.health-item {
    padding: 14px 16px;
    border-radius: 20px;
    background: rgba(248, 250, 255, 0.9);
    border: 1px solid rgba(194, 199, 208, 0.18);
}

.health-label {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-tertiary);
}

.health-value {
    display: block;
    margin-top: 10px;
    font-size: 28px;
    font-weight: 800;
    color: var(--primary);
}

.flow-card {
    margin-top: 16px;
    padding: 16px;
    border-radius: 24px;
    background: linear-gradient(180deg, rgba(214, 227, 255, 0.36), rgba(255, 255, 255, 0.9));
    border: 1px solid rgba(194, 199, 208, 0.18);
}

.flow-title {
    font-size: 14px;
    font-weight: 800;
    color: var(--text-primary);
    margin-bottom: 12px;
}

.flow-step {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 0;
    font-size: 13px;
    line-height: 1.65;
    color: var(--text-secondary);
}

.flow-index {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--primary);
    color: #fff;
    font-size: 12px;
    font-weight: 800;
}

@media (max-width: 960px) {
    .dashboard-hero,
    .content-grid {
        grid-template-columns: 1fr;
    }

    .metric-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 640px) {
    .dashboard-hero {
        padding: 20px;
    }

    .hero-copy h2 {
        font-size: 24px;
    }

    .metric-grid {
        grid-template-columns: 1fr;
    }

    .health-list {
        grid-template-columns: 1fr;
    }

    .panel,
    .dashboard-hero {
        border-radius: 24px;
    }
}
</style>
