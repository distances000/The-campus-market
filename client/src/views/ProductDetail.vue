<template>
<div class="detail-page"><div class="page-container" style="max-width:860px" v-if="product">
<div class="detail-images" v-if="product.images&&product.images.length"><el-carousel height="400px" indicator-position="none"><el-carousel-item v-for="(img,i) in product.images" :key="i"><img :src="img" class="detail-main-image"/></el-carousel-item></el-carousel></div>
<div class="detail-images detail-images-empty" v-else><div class="no-image"><el-icon :size="48"><Picture/></el-icon><span>暂无图片</span></div></div>
<div class="detail-header">
    <div class="detail-price">¥{{product.price}}</div>
    <div class="detail-original" v-if="product.original_price">原价 ¥{{product.original_price}}</div>
    <h1 class="detail-title">
        <span>{{product.title}}</span>
        <el-tag :type="statusMeta.type" size="small">{{ statusMeta.label }}</el-tag>
    </h1>
    <div class="detail-meta">
        <el-tag size="small">{{ condMap[product.condition]||product.condition }}</el-tag>
        <el-tag size="small" type="info">{{ catMap[product.category]||product.category }}</el-tag>
        <span>{{product.views}} 次浏览</span>
        <span>{{product.created_at}}</span>
    </div>
</div>
<el-alert v-if="product.status!=='active'" :title="statusMeta.label==='已售出'?'该商品已售出，当前仅保留详情记录。':'该商品已下架，当前仅保留详情记录。'" :type="statusMeta.type==='warning'?'warning':'info'" show-icon class="status-alert"/>
<div class="detail-seller">
    <div class="seller-main">
        <el-avatar :size="44">{{(product.seller_name||"")[0]}}</el-avatar>
        <div class="seller-info">
            <div class="seller-name">{{product.seller_name}}</div>
            <div class="seller-campus" v-if="product.campus">{{product.campus}}</div>
        </div>
    </div>
    <div class="seller-credit">
        <div class="seller-credit-score">{{ Number(product.seller_credit?.rating_avg || 0).toFixed(1) }}</div>
        <div class="seller-credit-meta">
            <span>信用评分</span>
            <span>{{ product.seller_credit?.review_count || 0 }} 条成交评价</span>
        </div>
    </div>
    <el-button type="primary" @click="goChat" v-if="canChat">聊一聊</el-button>
</div>
<div class="detail-section" v-if="product.description"><h3>商品详情</h3><p>{{product.description}}</p></div>
<div class="detail-section" v-if="product.current_order">
    <h3>当前订单</h3>
    <div class="order-inline">
        <el-tag :type="orderStatusMeta.type">{{ orderStatusMeta.label }}</el-tag>
        <span>订单创建于 {{ product.current_order.created_at }}</span>
        <span v-if="product.current_order.completed_at">完成于 {{ product.current_order.completed_at }}</span>
    </div>
</div>
<div class="detail-section">
    <h3>成交评价</h3>
    <div class="review-summary">
        <div class="review-summary-card">
            <div class="review-score">{{ Number(product.seller_credit?.rating_avg || 0).toFixed(1) }}</div>
            <div class="review-meta">累计 {{ product.seller_credit?.review_count || 0 }} 条评价</div>
        </div>
        <div class="review-summary-text">评分来自已完成订单的真实交易双方，优先展示最近成交评价。</div>
    </div>
    <div class="review-list" v-if="product.reviews?.length">
        <div v-for="review in product.reviews" :key="review.id" class="review-item">
            <div class="review-head">
                <div>
                    <div class="review-author">{{ review.reviewer_name }}</div>
                    <div class="review-time">{{ review.created_at }}</div>
                </div>
                <div class="review-rating">{{ "★".repeat(review.rating) }}</div>
            </div>
            <div class="review-content">{{ review.content || "用户未填写评价内容" }}</div>
        </div>
    </div>
    <el-empty v-else description="暂时还没有成交评价"/>
</div>
<div class="detail-actions">
    <el-button :type="product.is_favorited?'warning':'default'" size="large" @click="handleFavorite" :disabled="!userStore.isLoggedIn"><el-icon><Star/></el-icon>{{product.is_favorited?'已收藏':'收藏'}}</el-button>
    <el-button type="primary" size="large" @click="goChat" v-if="canChat">聊一聊</el-button>
    <el-button type="success" size="large" @click="handleCreateOrder" :loading="creatingOrder" v-if="canOrder">立即下单</el-button>
    <template v-if="isOwner">
        <el-button size="large" @click="handleEdit">编辑商品</el-button>
        <template v-if="product.status==='active'">
            <el-button size="large" type="success" @click="handleSetStatus('sold')">标记售出</el-button>
            <el-button size="large" type="warning" @click="handleSetStatus('inactive')">下架</el-button>
        </template>
        <template v-else-if="product.status==='inactive'">
            <el-button size="large" type="success" @click="handleSetStatus('active')">上架</el-button>
        </template>
        <el-button size="large" @click="handleDelete" type="danger">删除</el-button>
    </template>
</div>
</div><div class="page-container" v-else-if="!loading"><el-empty description="商品不存在或已被删除"/></div></div>
</template>
<script setup>
import { ref, onMounted, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { useUserStore } from "../stores/user";
import { getProduct, deleteProduct, toggleFavorite, updateProduct } from "../api/products";
import { createOrder } from "../api/orders";
import { PRODUCT_CATEGORY_MAP as catMap, PRODUCT_CONDITION_MAP as condMap, getProductStatusMeta } from "../utils/product";
import { getOrderStatusMeta } from "../utils/order";
import { Picture, Star } from "@element-plus/icons-vue";

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const product = ref(null);
const loading = ref(true);
const creatingOrder = ref(false);
const isOwner = computed(() => userStore.user?.id === product.value?.seller_id);
const canChat = computed(() => userStore.isLoggedIn && userStore.user?.id !== product.value?.seller_id && (product.value?.status === "active" || !!product.value?.current_order));
const canOrder = computed(() => userStore.isLoggedIn && !isOwner.value && product.value?.status === "active" && (!product.value?.current_order || product.value.current_order.status === "cancelled"));
const statusMeta = computed(() => getProductStatusMeta(product.value?.status));
const orderStatusMeta = computed(() => getOrderStatusMeta(product.value?.current_order?.status));

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
        const r = await toggleFavorite(product.value.id);
        product.value.is_favorited = r.data.favorited;
        ElMessage.success(r.message);
    } catch {}
}

async function handleCreateOrder() {
    if (!userStore.isLoggedIn) {
        ElMessage.warning("请先登录");
        return;
    }
    creatingOrder.value = true;
    try {
        await createOrder(product.value.id);
        ElMessage.success("下单成功");
        await fetchProduct();
        router.push({ path: "/profile", query: { tab: "orders" } });
    } catch {} finally {
        creatingOrder.value = false;
    }
}

function handleEdit() {
    router.push("/publish/" + product.value.id);
}

function goChat() {
    router.push({ path: "/chat/" + product.value.seller_id, query: { name: product.value.seller_name || "" } });
}

async function handleSetStatus(status) {
    const confirmText = status === "sold" ? "确认将该商品标记为售出？" : status === "inactive" ? "确认将该商品下架？" : "确认将该商品重新上架？";
    try {
        await ElMessageBox.confirm(confirmText, "操作确认", { type: "warning" });
        const r = await updateProduct(product.value.id, { status });
        product.value = { ...product.value, ...r.data };
        ElMessage.success(status === "sold" ? "已标记为售出" : status === "inactive" ? "已下架" : "已上架");
        await fetchProduct();
    } catch {}
}

async function handleDelete() {
    try {
        await ElMessageBox.confirm("确认删除该商品？删除后无法恢复。", "删除确认", { type: "warning" });
        await deleteProduct(product.value.id);
        ElMessage.success("已删除");
        router.push("/home");
    } catch {}
}

onMounted(fetchProduct);
</script>
<style scoped>
.detail-page {
    padding-top: 8px;
}

.detail-images {
    background: rgba(255, 255, 255, 0.88);
    border-radius: 32px;
    overflow: hidden;
    margin-bottom: 18px;
    border: 1px solid rgba(194, 199, 208, 0.22);
    box-shadow: var(--shadow);
}

.detail-images-empty {
    aspect-ratio: 16 / 9;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(180deg, #eef2fa 0%, #e7ebf3 100%);
}

.no-image {
    display: flex;
    flex-direction: column;
    align-items: center;
    color: var(--text-tertiary);
    gap: 8px;
}

.detail-main-image {
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: linear-gradient(180deg, #eef2fa 0%, #e7ebf3 100%);
}

.detail-header {
    background: rgba(255, 255, 255, 0.88);
    padding: 24px;
    border-radius: 30px;
    margin-bottom: 14px;
    border: 1px solid rgba(194, 199, 208, 0.22);
    box-shadow: var(--shadow);
}

.detail-price {
    font-size: 34px;
    font-weight: 800;
    color: var(--danger);
    letter-spacing: -0.02em;
}

.detail-original {
    font-size: 13px;
    color: var(--text-tertiary);
    text-decoration: line-through;
    margin-bottom: 10px;
}

.detail-title {
    font-size: 22px;
    font-weight: 700;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
}

.detail-meta {
    display: flex;
    gap: 10px;
    align-items: center;
    font-size: 12px;
    color: var(--text-tertiary);
    flex-wrap: wrap;
}

.status-alert {
    margin-bottom: 14px;
}

.detail-seller {
    background: linear-gradient(180deg, rgba(214, 227, 255, 0.42) 0%, rgba(255, 255, 255, 0.92) 100%);
    padding: 20px 22px;
    border-radius: 28px;
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 14px;
    border: 1px solid rgba(194, 199, 208, 0.22);
    box-shadow: var(--shadow-md);
}

.seller-main {
    display: flex;
    align-items: center;
    gap: 14px;
    flex: 1;
    min-width: 0;
}

.seller-info {
    min-width: 0;
}

.seller-name {
    font-weight: 700;
    font-size: 16px;
}

.seller-campus {
    font-size: 12px;
    color: var(--text-tertiary);
    margin-top: 4px;
}

.seller-credit {
    min-width: 164px;
    padding: 12px 14px;
    border-radius: 22px;
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid rgba(194, 199, 208, 0.18);
}

.seller-credit-score {
    font-size: 28px;
    font-weight: 800;
    color: var(--primary);
    line-height: 1;
}

.seller-credit-meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: var(--text-secondary);
    margin-top: 8px;
}

.detail-section {
    background: rgba(255, 255, 255, 0.88);
    padding: 22px;
    border-radius: 28px;
    margin-bottom: 14px;
    border: 1px solid rgba(194, 199, 208, 0.22);
    box-shadow: var(--shadow);
}

.detail-section h3 {
    font-size: 16px;
    font-weight: 700;
    margin-bottom: 12px;
}

.detail-section p {
    font-size: 14px;
    line-height: 1.8;
    color: var(--text-secondary);
    white-space: pre-wrap;
}

.order-inline {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
    font-size: 13px;
    color: var(--text-secondary);
}

.review-summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 16px;
    flex-wrap: wrap;
}

.review-summary-card {
    display: flex;
    align-items: flex-end;
    gap: 12px;
    padding: 16px 18px;
    border-radius: 24px;
    background: rgba(214, 227, 255, 0.42);
    border: 1px solid rgba(194, 199, 208, 0.18);
}

.review-score {
    font-size: 36px;
    font-weight: 800;
    color: var(--primary);
    line-height: 1;
}

.review-meta {
    font-size: 13px;
    color: var(--text-secondary);
}

.review-summary-text {
    font-size: 13px;
    color: var(--text-tertiary);
    max-width: 340px;
    line-height: 1.8;
}

.review-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.review-item {
    padding: 16px 18px;
    border: 1px solid rgba(194, 199, 208, 0.18);
    border-radius: 22px;
    background: rgba(240, 242, 248, 0.48);
}

.review-head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
    margin-bottom: 8px;
}

.review-author {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-primary);
}

.review-rating {
    font-size: 14px;
    color: #f2a21b;
    display: flex;
    gap: 8px;
    align-items: center;
    font-weight: 700;
}

.review-time {
    color: var(--text-tertiary);
    font-size: 12px;
    margin-top: 4px;
}

.review-content {
    font-size: 14px;
    color: var(--text-secondary);
    line-height: 1.7;
}

.detail-actions {
    background: rgba(248, 250, 255, 0.92);
    backdrop-filter: blur(14px);
    padding: 16px 20px;
    border-radius: 28px;
    display: flex;
    gap: 12px;
    position: sticky;
    bottom: 84px;
    flex-wrap: wrap;
    border: 1px solid rgba(194, 199, 208, 0.24);
    box-shadow: var(--shadow-lg);
}

@media (max-width: 640px) {
    .detail-header,
    .detail-section,
    .detail-seller {
        border-radius: 24px;
    }

    .detail-seller {
        flex-wrap: wrap;
        align-items: flex-start;
    }

    .seller-credit {
        width: 100%;
    }

    .review-summary {
        align-items: flex-start;
    }

    .detail-actions {
        bottom: 84px;
    }
}
</style>
