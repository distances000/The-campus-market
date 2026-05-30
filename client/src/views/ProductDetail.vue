<template>
<div class="detail-page"><div class="page-container" style="max-width:800px" v-if="product">
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
<div class="detail-seller"><el-avatar :size="40">{{(product.seller_name||"")[0]}}</el-avatar><div class="seller-info"><div class="seller-name">{{product.seller_name}}</div><div class="seller-campus" v-if="product.campus">{{product.campus}}</div></div><el-button type="primary" @click="goChat" v-if="canChat">聊一聊</el-button></div>
<div class="detail-section" v-if="product.description"><h3>商品详情</h3><p>{{product.description}}</p></div>
<div class="detail-actions">
    <el-button :type="product.is_favorited?'warning':'default'" size="large" @click="handleFavorite" :disabled="!userStore.isLoggedIn"><el-icon><Star/></el-icon>{{product.is_favorited?'已收藏':'收藏'}}</el-button>
    <el-button type="primary" size="large" @click="goChat" v-if="canChat">聊一聊</el-button>
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
import { PRODUCT_CATEGORY_MAP as catMap, PRODUCT_CONDITION_MAP as condMap, getProductStatusMeta } from "../utils/product";
import { Picture, Star } from "@element-plus/icons-vue";

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const product = ref(null);
const loading = ref(true);
const isOwner = computed(() => userStore.user?.id === product.value?.seller_id);
const canChat = computed(() => userStore.isLoggedIn && userStore.user?.id !== product.value?.seller_id && product.value?.status === "active");
const statusMeta = computed(() => getProductStatusMeta(product.value?.status));

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
        product.value = r.data;
        ElMessage.success(status === "sold" ? "已标记为售出" : status === "inactive" ? "已下架" : "已上架");
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
.detail-section{background:var(--bg-primary);padding:20px;border-radius:var(--radius);margin-bottom:12px;}
.detail-section h3{font-size:15px;font-weight:600;margin-bottom:10px;}
.detail-section p{font-size:14px;line-height:1.7;color:var(--text-secondary);white-space:pre-wrap;}
.detail-actions{background:var(--bg-primary);padding:16px 20px;border-radius:var(--radius);display:flex;gap:12px;position:sticky;bottom:64px;flex-wrap:wrap;}
</style>
