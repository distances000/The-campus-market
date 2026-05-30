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
    <el-avatar :size="40">{{(product.seller_name||"")[0]}}</el-avatar>
    <div class="seller-info">
        <div class="seller-name">{{product.seller_name}}</div>
        <div class="seller-campus" v-if="product.campus">{{product.campus}}</div>
    </div>
    <div class="seller-credit">
        <div class="credit-score">{{ product.seller_credit?.rating_avg?.toFixed ? product.seller_credit.rating_avg.toFixed(1) : Number(product.seller_credit?.rating_avg || 0).toFixed(1) }}</div>
        <div class="credit-text">信用分 · {{ product.seller_credit?.review_count || 0 }} 条评价</div>
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
        <div class="review-score">{{ Number(product.seller_credit?.rating_avg || 0).toFixed(1) }}</div>
        <div class="review-meta">累计 {{ product.seller_credit?.review_count || 0 }} 条评价</div>
    </div>
    <div class="review-list" v-if="product.reviews?.length">
        <div v-for="review in product.reviews" :key="review.id" class="review-item">
            <div class="review-head">
                <div class="review-author">{{ review.reviewer_name }}</div>
                <div class="review-rating">{{ "★".repeat(review.rating) }}<span class="review-time">{{ review.created_at }}</span></div>
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
.detail-images{background:var(--bg-primary);border-radius:var(--radius);overflow:hidden;margin-bottom:16px;}
.detail-images-empty{aspect-ratio:16/9;display:flex;align-items:center;justify-content:center;background:var(--bg-tertiary);}
.no-image{display:flex;flex-direction:column;align-items:center;color:var(--text-tertiary);gap:8px;}
.detail-main-image{width:100%;height:100%;object-fit:contain;background:#f5f5f5;}
.detail-header{background:var(--bg-primary);padding:20px;border-radius:var(--radius);margin-bottom:12px;}
.detail-price{font-size:28px;font-weight:700;color:var(--danger);}
.detail-original{font-size:13px;color:var(--text-tertiary);text-decoration:line-through;margin-bottom:8px;}
.detail-title{font-size:18px;font-weight:600;margin-bottom:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.detail-meta{display:flex;gap:10px;align-items:center;font-size:12px;color:var(--text-tertiary);flex-wrap:wrap;}
.status-alert{margin-bottom:12px;}
.detail-seller{background:var(--bg-primary);padding:16px 20px;border-radius:var(--radius);display:flex;align-items:center;gap:12px;margin-bottom:12px;}
.seller-info{flex:1;}.seller-name{font-weight:500;}.seller-campus{font-size:12px;color:var(--text-tertiary);}
.seller-credit{min-width:120px;text-align:right;}
.credit-score{font-size:20px;font-weight:700;color:var(--primary);}
.credit-text{font-size:12px;color:var(--text-tertiary);}
.detail-section{background:var(--bg-primary);padding:20px;border-radius:var(--radius);margin-bottom:12px;}
.detail-section h3{font-size:15px;font-weight:600;margin-bottom:10px;}
.detail-section p{font-size:14px;line-height:1.7;color:var(--text-secondary);white-space:pre-wrap;}
.order-inline{display:flex;gap:12px;align-items:center;flex-wrap:wrap;font-size:13px;color:var(--text-secondary);}
.review-summary{display:flex;align-items:flex-end;gap:12px;margin-bottom:14px;}
.review-score{font-size:30px;font-weight:700;color:var(--primary);}
.review-meta{font-size:13px;color:var(--text-tertiary);}
.review-list{display:flex;flex-direction:column;gap:12px;}
.review-item{padding:12px;border:1px solid var(--border);border-radius:10px;}
.review-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:6px;}
.review-author{font-size:14px;font-weight:600;}
.review-rating{font-size:13px;color:#f59e0b;display:flex;gap:8px;align-items:center;}
.review-time{color:var(--text-tertiary);font-size:12px;}
.review-content{font-size:14px;color:var(--text-secondary);line-height:1.6;}
.detail-actions{background:var(--bg-primary);padding:16px 20px;border-radius:var(--radius);display:flex;gap:12px;position:sticky;bottom:64px;flex-wrap:wrap;}
</style>
