<template>
    <div class="home-page">
        <div class="category-bar">
            <div
                v-for="cat in categories"
                :key="cat.value"
                class="category-item"
                :class="{ active: currentCategory === cat.value }"
                @click="selectCategory(cat.value)"
            >
                {{ cat.label }}
            </div>
        </div>

        <div class="filter-bar">
            <el-select
                v-model="currentCampus"
                placeholder="选择校区"
                size="default"
                clearable
                @change="reloadProducts"
            >
                <el-option
                    v-for="campus in campuses"
                    :key="campus.value"
                    :label="campus.label"
                    :value="campus.value"
                />
            </el-select>
            <el-select v-model="sortBy" size="default" @change="reloadProducts">
                <el-option label="最新发布" value="latest" />
                <el-option label="价格从低到高" value="price_asc" />
                <el-option label="价格从高到低" value="price_desc" />
                <el-option label="最热" value="hot" />
            </el-select>
        </div>

        <div v-if="isInitialLoading" class="product-grid skeleton-grid">
            <div v-for="item in skeletonItems" :key="item" class="product-card skeleton-card">
                <div class="skeleton-image skeleton-shimmer"></div>
                <div class="product-info skeleton-info">
                    <div class="skeleton-line skeleton-shimmer skeleton-title"></div>
                    <div class="skeleton-line skeleton-shimmer skeleton-title short"></div>
                    <div class="skeleton-line skeleton-shimmer skeleton-price"></div>
                    <div class="skeleton-footer">
                        <div class="skeleton-line skeleton-shimmer skeleton-meta"></div>
                        <div class="skeleton-line skeleton-shimmer skeleton-meta short"></div>
                    </div>
                </div>
            </div>
        </div>

        <div v-else-if="products.length > 0" class="product-grid">
            <div
                v-for="product in products"
                :key="product.id"
                class="product-card"
                @click="$router.push('/product/' + product.id)"
            >
                <div class="product-image">
                    <img :src="getImg(product)" :alt="product.title" @error="onImgErr" />
                    <span v-if="product.condition" class="product-condition">
                        {{ condMap[product.condition] || product.condition }}
                    </span>
                    <span class="product-status" :class="'status-' + getProductStatusMeta(product.status).type">
                        {{ getProductStatusMeta(product.status).label }}
                    </span>
                </div>
                <div class="product-info">
                    <h3 class="product-title">{{ product.title }}</h3>
                    <div class="product-meta">
                        <span class="product-price">&yen;{{ product.price }}</span>
                        <span v-if="product.original_price" class="product-original">&yen;{{ product.original_price }}</span>
                    </div>
                    <div class="product-footer">
                        <span class="product-seller">{{ product.seller_name }}</span>
                        <span v-if="product.campus" class="product-campus">{{ product.campus }}</span>
                    </div>
                </div>
            </div>
        </div>

        <el-empty v-else description="暂无商品" />

        <div v-if="hasMore && !isInitialLoading" class="load-more">
            <el-button :loading="loading" @click="loadMore" size="large">加载更多</el-button>
        </div>
    </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { getProducts } from "../api/products";
import { getProductStatusMeta } from "../utils/product";
import { CAMPUS_OPTIONS, PRODUCT_CATEGORY_FILTER_OPTIONS } from "../utils/options";

const route = useRoute();

const categories = PRODUCT_CATEGORY_FILTER_OPTIONS;
const campuses = CAMPUS_OPTIONS;
const condMap = {
    brand_new: "全新",
    like_new: "几乎全新",
    used: "二手",
    old: "较旧"
};

const products = ref([]);
const currentCategory = ref("all");
const currentCampus = ref("");
const sortBy = ref("latest");
const loading = ref(false);
const page = ref(1);
const total = ref(0);
const hasMore = ref(false);

const skeletonItems = Array.from({ length: 8 }, (_, index) => index + 1);
const isInitialLoading = computed(() => loading.value && page.value === 1 && products.value.length === 0);
const defImg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%23f0f0f0' width='200' height='200'/%3E%3Ctext x='100' y='105' text-anchor='middle' fill='%23ccc' font-size='14'%3E暂无图片%3C/text%3E%3C/svg%3E";

function getImg(product) {
    return product.images && product.images.length ? product.images[0] : defImg;
}

function onImgErr(event) {
    event.target.src = defImg;
}

function selectCategory(category) {
    if (currentCategory.value === category) {
        return;
    }
    currentCategory.value = category;
    reloadProducts();
}

function reloadProducts() {
    page.value = 1;
    products.value = [];
    loadProducts();
}

async function loadProducts() {
    loading.value = true;
    try {
        const response = await getProducts({
            category: currentCategory.value === "all" ? undefined : currentCategory.value,
            campus: currentCampus.value || undefined,
            sort: sortBy.value,
            page: page.value,
            keyword: route.query.keyword || undefined
        });
        const data = response.data;
        if (page.value === 1) {
            products.value = data.list;
        } else {
            products.value.push(...data.list);
        }
        total.value = data.total;
        hasMore.value = products.value.length < total.value;
    } catch {
    } finally {
        loading.value = false;
    }
}

function loadMore() {
    page.value += 1;
    loadProducts();
}

onMounted(loadProducts);

watch(() => route.query.keyword, reloadProducts);
</script>

<style scoped>
.home-page {
    padding-top: 8px;
}

.category-bar {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    padding: 8px 16px 2px;
    -webkit-overflow-scrolling: touch;
}

.category-bar::-webkit-scrollbar {
    display: none;
}

.category-item {
    flex-shrink: 0;
    padding: 11px 18px;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-secondary);
    border-radius: 999px;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
    background: rgba(232, 238, 249, 0.84);
    border: 1px solid transparent;
}

.category-item.active {
    background: var(--chip-active);
    color: var(--primary);
    box-shadow: inset 0 0 0 1px rgba(65, 95, 145, 0.14);
}

.filter-bar {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    padding: 14px 16px 6px;
}

.product-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 14px;
    padding: 14px 16px 8px;
}

.skeleton-grid {
    pointer-events: none;
}

@media (min-width: 640px) {
    .product-grid {
        grid-template-columns: repeat(3, 1fr);
    }
}

@media (min-width: 960px) {
    .product-grid {
        grid-template-columns: repeat(4, 1fr);
        gap: 18px;
    }
}

.product-card {
    background: rgba(255, 255, 255, 0.88);
    border-radius: 24px;
    overflow: hidden;
    cursor: pointer;
    transition: transform 0.24s ease, box-shadow 0.24s ease, background-color 0.24s ease;
    box-shadow: var(--shadow);
    border: 1px solid rgba(194, 199, 208, 0.22);
    backdrop-filter: blur(10px);
}

.product-card:hover {
    transform: translateY(-3px);
    box-shadow: var(--shadow-lg);
    background: rgba(255, 255, 255, 0.96);
}

.skeleton-card {
    cursor: default;
}

.skeleton-card:hover {
    transform: none;
    box-shadow: var(--shadow);
    background: rgba(255, 255, 255, 0.88);
}

.product-image,
.skeleton-image {
    position: relative;
    aspect-ratio: 1;
    overflow: hidden;
    background: linear-gradient(180deg, #eef2fa 0%, #e7ebf3 100%);
}

.product-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.product-condition,
.product-status {
    position: absolute;
    top: 10px;
    font-size: 11px;
    font-weight: 700;
    padding: 5px 10px;
    border-radius: 999px;
    backdrop-filter: blur(10px);
}

.product-condition {
    left: 10px;
    background: rgba(28, 27, 33, 0.66);
    color: #fff;
}

.product-status {
    right: 10px;
    background: rgba(252, 248, 255, 0.92);
    box-shadow: inset 0 0 0 1px rgba(194, 199, 208, 0.34);
}

.status-success {
    color: #2f6a1f;
}

.status-warning {
    color: #8f4e00;
}

.status-info {
    color: #525866;
}

.product-info {
    padding: 14px 14px 16px;
}

.skeleton-info {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.product-title {
    font-size: 15px;
    font-weight: 700;
    line-height: 1.45;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    margin-bottom: 10px;
    color: var(--text-primary);
}

.product-meta {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 10px;
}

.product-price {
    font-size: 20px;
    font-weight: 700;
    color: var(--danger);
    letter-spacing: -0.01em;
}

.product-original {
    font-size: 12px;
    color: var(--text-tertiary);
    text-decoration: line-through;
}

.product-footer,
.skeleton-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--text-secondary);
}

.product-seller,
.product-campus {
    display: inline-flex;
    align-items: center;
    min-width: 0;
}

.skeleton-line {
    border-radius: 999px;
    background: linear-gradient(90deg, rgba(220, 226, 239, 0.75) 25%, rgba(243, 246, 252, 0.96) 50%, rgba(220, 226, 239, 0.75) 75%);
    background-size: 200% 100%;
}

.skeleton-title {
    height: 14px;
    width: 100%;
}

.skeleton-title.short {
    width: 66%;
}

.skeleton-price {
    width: 42%;
    height: 20px;
    margin-top: 4px;
}

.skeleton-meta {
    width: 36%;
    height: 12px;
}

.skeleton-meta.short {
    width: 24%;
}

.skeleton-shimmer {
    animation: skeleton-shimmer 1.25s ease-in-out infinite;
}

.load-more {
    text-align: center;
    padding: 24px 0 8px;
}

@keyframes skeleton-shimmer {
    0% {
        background-position: 200% 0;
    }

    100% {
        background-position: -200% 0;
    }
}

@media (max-width: 639px) {
    .filter-bar {
        grid-template-columns: 1fr;
    }
}
</style>
