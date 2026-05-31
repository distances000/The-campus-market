<template>
    <div class="detail-page">
        <div v-if="product" class="page-container detail-container">
            <div v-if="product.images && product.images.length" class="detail-images">
                <el-carousel height="400px" indicator-position="none">
                    <el-carousel-item v-for="(img, index) in product.images" :key="index">
                        <img :src="img" class="detail-main-image" />
                    </el-carousel-item>
                </el-carousel>
            </div>
            <div v-else class="detail-images detail-images-empty">
                <div class="no-image">
                    <el-icon :size="48">
                        <Picture />
                    </el-icon>
                    <span>暂无图片</span>
                </div>
            </div>

            <div class="detail-header">
                <div class="detail-price">￥{{ product.price }}</div>
                <div v-if="product.original_price" class="detail-original">
                    原价 ￥{{ product.original_price }}
                </div>
                <h1 class="detail-title">
                    <span>{{ product.title }}</span>
                    <el-tag :type="statusMeta.type" size="small">{{ statusMeta.label }}</el-tag>
                </h1>
                <div class="detail-meta">
                    <el-tag size="small">{{ condMap[product.condition] || product.condition }}</el-tag>
                    <el-tag size="small" type="info">{{ catMap[product.category] || product.category }}</el-tag>
                    <span>{{ product.views }} 次浏览</span>
                    <span>{{ product.created_at }}</span>
                </div>
            </div>

            <el-alert
                v-if="product.status !== 'active'"
                class="status-alert"
                :title="statusAlertText"
                :type="statusMeta.type === 'warning' ? 'warning' : 'info'"
                show-icon
            />

            <div class="detail-seller">
                <el-avatar :size="40">{{ (product.seller_name || "")[0] }}</el-avatar>
                <div class="seller-info">
                    <div class="seller-name">{{ product.seller_name }}</div>
                    <div v-if="product.campus" class="seller-campus">{{ product.campus }}</div>
                </div>
                <div class="seller-actions">
                    <el-button v-if="canReport" text @click="openReportDialog">举报商品</el-button>
                    <el-button v-if="canChat" type="primary" @click="goChat">聊一聊</el-button>
                </div>
            </div>

            <div v-if="product.description" class="detail-section">
                <h3>商品详情</h3>
                <p>{{ product.description }}</p>
            </div>

            <div class="detail-actions">
                <el-button
                    size="large"
                    :type="product.is_favorited ? 'warning' : 'default'"
                    :disabled="!userStore.isLoggedIn"
                    @click="handleFavorite"
                >
                    <el-icon><Star /></el-icon>
                    {{ product.is_favorited ? "已收藏" : "收藏" }}
                </el-button>
                <el-button v-if="canChat" type="primary" size="large" @click="goChat">聊一聊</el-button>
                <el-button v-if="canReport" size="large" @click="openReportDialog">举报</el-button>

                <template v-if="isOwner">
                    <el-button size="large" @click="handleEdit">编辑商品</el-button>
                    <template v-if="product.status === 'active'">
                        <el-button size="large" type="success" @click="handleSetStatus('sold')">标记售出</el-button>
                        <el-button size="large" type="warning" @click="handleSetStatus('inactive')">下架</el-button>
                    </template>
                    <template v-else-if="product.status === 'inactive'">
                        <el-button size="large" type="success" @click="handleSetStatus('active')">重新上架</el-button>
                    </template>
                    <el-button size="large" type="danger" @click="handleDelete">删除</el-button>
                </template>
            </div>
        </div>

        <div v-else-if="!loading" class="page-container detail-container">
            <el-empty description="商品不存在或已被删除" />
        </div>

        <el-dialog v-model="showReportDialog" title="举报商品" width="420px" destroy-on-close>
            <el-form label-position="top">
                <el-form-item label="举报原因">
                    <el-select v-model="reportForm.reason" placeholder="请选择举报原因">
                        <el-option
                            v-for="option in REPORT_REASON_OPTIONS"
                            :key="option.value"
                            :label="option.label"
                            :value="option.value"
                        />
                    </el-select>
                </el-form-item>
                <el-form-item label="补充说明">
                    <el-input
                        v-model="reportForm.description"
                        type="textarea"
                        :rows="4"
                        maxlength="500"
                        show-word-limit
                        placeholder="可以补充更具体的情况，便于管理员判断"
                    />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="showReportDialog = false">取消</el-button>
                <el-button type="primary" :loading="reportSubmitting" @click="handleSubmitReport">提交举报</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { Picture, Star } from "@element-plus/icons-vue";
import { useUserStore } from "../stores/user";
import { createReport } from "../api/reports";
import { deleteProduct, getProduct, toggleFavorite, updateProduct } from "../api/products";
import {
    PRODUCT_CATEGORY_MAP as catMap,
    PRODUCT_CONDITION_MAP as condMap,
    getProductStatusMeta
} from "../utils/product";
import { REPORT_REASON_OPTIONS } from "../utils/report";

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

const product = ref(null);
const loading = ref(true);
const showReportDialog = ref(false);
const reportSubmitting = ref(false);
const reportForm = reactive({
    reason: "",
    description: ""
});

const isOwner = computed(() => userStore.user?.id === product.value?.seller_id);
const canChat = computed(() => {
    return userStore.isLoggedIn && userStore.user?.id !== product.value?.seller_id && product.value?.status === "active";
});
const canReport = computed(() => {
    return userStore.isLoggedIn && userStore.user?.id !== product.value?.seller_id;
});
const statusMeta = computed(() => getProductStatusMeta(product.value?.status));
const statusAlertText = computed(() => {
    if (product.value?.status === "sold") {
        return "该商品已售出，当前仅保留详情记录。";
    }
    return "该商品已下架，当前仅保留详情记录。";
});

function resetReportForm() {
    reportForm.reason = "";
    reportForm.description = "";
}

async function fetchProduct() {
    loading.value = true;
    try {
        product.value = (await getProduct(route.params.id)).data;
    } catch {
        product.value = null;
    } finally {
        loading.value = false;
    }
}

async function handleFavorite() {
    if (!userStore.isLoggedIn) {
        ElMessage.warning("请先登录");
        return;
    }

    try {
        const result = await toggleFavorite(product.value.id);
        product.value.is_favorited = result.data.favorited;
        ElMessage.success(result.message);
    } catch {}
}

function handleEdit() {
    router.push("/publish/" + product.value.id);
}

function goChat() {
    router.push({
        path: "/chat/" + product.value.seller_id,
        query: { name: product.value.seller_name || "" }
    });
}

function openReportDialog() {
    if (!canReport.value) {
        return;
    }
    resetReportForm();
    showReportDialog.value = true;
}

async function handleSubmitReport() {
    if (!reportForm.reason) {
        ElMessage.warning("请选择举报原因");
        return;
    }

    reportSubmitting.value = true;
    try {
        await createReport({
            target_type: "product",
            target_id: product.value.id,
            reason: reportForm.reason,
            description: reportForm.description
        });
        ElMessage.success("举报已提交");
        showReportDialog.value = false;
        resetReportForm();
    } finally {
        reportSubmitting.value = false;
    }
}

async function handleSetStatus(status) {
    const confirmTextMap = {
        sold: "确认将该商品标记为售出？",
        inactive: "确认将该商品下架？",
        active: "确认将该商品重新上架？"
    };
    const successTextMap = {
        sold: "已标记为售出",
        inactive: "已下架",
        active: "已重新上架"
    };

    try {
        await ElMessageBox.confirm(confirmTextMap[status], "操作确认", { type: "warning" });
        const result = await updateProduct(product.value.id, { status });
        product.value = {
            ...product.value,
            ...result.data
        };
        ElMessage.success(successTextMap[status]);
    } catch {}
}

async function handleDelete() {
    try {
        await ElMessageBox.confirm("确认删除该商品？删除后无法恢复。", "删除确认", {
            type: "warning"
        });
        await deleteProduct(product.value.id);
        ElMessage.success("已删除");
        router.push("/home");
    } catch {}
}

onMounted(fetchProduct);
</script>

<style scoped>
.detail-container {
    max-width: 800px;
}

.detail-images {
    margin-bottom: 16px;
    overflow: hidden;
    border-radius: var(--radius);
    background: var(--bg-primary);
}

.detail-images-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 16 / 9;
    background: var(--bg-tertiary);
}

.no-image {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
    color: var(--text-tertiary);
}

.detail-main-image {
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: #f5f5f5;
}

.detail-header {
    margin-bottom: 12px;
    padding: 20px;
    border-radius: var(--radius);
    background: var(--bg-primary);
}

.detail-price {
    font-size: 28px;
    font-weight: 700;
    color: var(--danger);
}

.detail-original {
    margin-bottom: 8px;
    font-size: 13px;
    color: var(--text-tertiary);
    text-decoration: line-through;
}

.detail-title {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin-bottom: 10px;
    font-size: 18px;
    font-weight: 600;
}

.detail-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    font-size: 12px;
    color: var(--text-tertiary);
}

.status-alert {
    margin-bottom: 12px;
}

.detail-seller {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 12px;
    padding: 16px 20px;
    border-radius: var(--radius);
    background: var(--bg-primary);
}

.seller-info {
    flex: 1;
}

.seller-name {
    font-weight: 500;
}

.seller-campus {
    font-size: 12px;
    color: var(--text-tertiary);
}

.seller-actions {
    display: flex;
    gap: 8px;
    align-items: center;
}

.detail-section {
    margin-bottom: 12px;
    padding: 20px;
    border-radius: var(--radius);
    background: var(--bg-primary);
}

.detail-section h3 {
    margin-bottom: 10px;
    font-size: 15px;
    font-weight: 600;
}

.detail-section p {
    font-size: 14px;
    line-height: 1.7;
    color: var(--text-secondary);
    white-space: pre-wrap;
}

.detail-actions {
    position: sticky;
    bottom: 64px;
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    padding: 16px 20px;
    border-radius: var(--radius);
    background: var(--bg-primary);
}

@media (max-width: 768px) {
    .detail-seller {
        flex-wrap: wrap;
    }

    .seller-actions {
        width: 100%;
        justify-content: flex-end;
    }

    .detail-actions {
        bottom: 76px;
    }
}
</style>
