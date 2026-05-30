<template>
<div class="home-page">
<div class="category-bar"><div v-for="cat in categories" :key="cat.value" class="category-item" :class="{active:currentCategory===cat.value}" @click="selectCategory(cat.value)">{{cat.label}}</div></div>
<div class="filter-bar">
<el-select v-model="currentCampus" placeholder="选择校区" size="default" clearable @change="loadProducts"><el-option v-for="c in campuses" :key="c.value" :label="c.label" :value="c.value"/></el-select>
<el-select v-model="sortBy" size="default" @change="loadProducts"><el-option label="最新发布" value="latest"/><el-option label="价格从低到高" value="price_asc"/><el-option label="价格从高到低" value="price_desc"/><el-option label="最热" value="hot"/></el-select>
</div>
<div class="product-grid" v-if="products.length>0">
<div v-for="p in products" :key="p.id" class="product-card" @click="$router.push('/product/'+p.id)">
<div class="product-image"><img :src="getImg(p)" :alt="p.title" @error="onImgErr"/><span class="product-condition" v-if="p.condition">{{condMap[p.condition]||p.condition}}</span><span class="product-status" :class="'status-'+getProductStatusMeta(p.status).type">{{getProductStatusMeta(p.status).label}}</span></div>
<div class="product-info"><h3 class="product-title">{{p.title}}</h3><div class="product-meta"><span class="product-price">&yen;{{p.price}}</span><span class="product-original" v-if="p.original_price">&yen;{{p.original_price}}</span></div><div class="product-footer"><span class="product-seller">{{p.seller_name}}</span><span class="product-campus" v-if="p.campus">{{p.campus}}</span></div></div>
</div></div>
<el-empty v-else description="暂无商品"/>
<div class="load-more" v-if="hasMore"><el-button :loading="loading" @click="loadMore" size="large">加载更多</el-button></div>
</div>
</template>
<script setup>
import {ref,onMounted,watch} from "vue";import {useRoute} from "vue-router";import {getProducts} from "../api/products";import { getProductStatusMeta } from "../utils/product";import { CAMPUS_OPTIONS, PRODUCT_CATEGORY_FILTER_OPTIONS } from "../utils/options";
const route=useRoute();
const categories=PRODUCT_CATEGORY_FILTER_OPTIONS;
const condMap={brand_new:"全新",like_new:"几乎全新",used:"二手",old:"较旧"};
const campuses=CAMPUS_OPTIONS;
const products=ref([]),currentCategory=ref("all"),currentCampus=ref(""),sortBy=ref("latest"),loading=ref(false),page=ref(1),total=ref(0),hasMore=ref(false);
const defImg="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%23f0f0f0' width='200' height='200'/%3E%3Ctext x='100' y='105' text-anchor='middle' fill='%23ccc' font-size='14'%3E????%3C/text%3E%3C/svg%3E";
function getImg(p){return(p.images&&p.images.length)?p.images[0]:defImg;}
function onImgErr(e){e.target.src=defImg;}
function selectCategory(c){currentCategory.value=c;page.value=1;products.value=[];loadProducts();}
async function loadProducts(){loading.value=true;try{const r=await getProducts({category:currentCategory.value==="all"?undefined:currentCategory.value,campus:currentCampus.value||undefined,sort:sortBy.value,page:page.value,keyword:route.query.keyword||undefined});const d=r.data;if(page.value===1)products.value=d.list;else products.value.push(...d.list);total.value=d.total;hasMore.value=products.value.length<total.value;}catch{}finally{loading.value=false;}}
function loadMore(){page.value++;loadProducts();}
onMounted(()=>loadProducts());
watch(()=>route.query.keyword,()=>{page.value=1;products.value=[];loadProducts();});
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

.product-image {
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

.product-footer {
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

.load-more {
    text-align: center;
    padding: 24px 0 8px;
}

@media (max-width: 639px) {
    .filter-bar {
        grid-template-columns: 1fr;
    }
}
</style>
