<template>
<div class="home-page">
<div class="category-bar"><div v-for="cat in categories" :key="cat.value" class="category-item" :class="{active:currentCategory===cat.value}" @click="selectCategory(cat.value)">{{cat.label}}</div></div>
<div class="filter-bar">
<el-select v-model="currentCampus" placeholder="????" size="default" clearable @change="loadProducts"><el-option v-for="c in campuses" :key="c" :label="c" :value="c"/></el-select>
<el-select v-model="sortBy" size="default" @change="loadProducts"><el-option label="????" value="latest"/><el-option label="??????" value="price_asc"/><el-option label="??????" value="price_desc"/><el-option label="????" value="hot"/></el-select>
</div>
<div class="product-grid" v-if="products.length>0">
<div v-for="p in products" :key="p.id" class="product-card" @click="$router.push('/product/'+p.id)">
<div class="product-image"><img :src="getImg(p)" :alt="p.title" @error="onImgErr"/><span class="product-condition" v-if="p.condition">{{condMap[p.condition]||p.condition}}</span></div>
<div class="product-info"><h3 class="product-title">{{p.title}}</h3><div class="product-meta"><span class="product-price">&yen;{{p.price}}</span><span class="product-original" v-if="p.original_price">&yen;{{p.original_price}}</span></div><div class="product-footer"><span class="product-seller">{{p.seller_name}}</span><span class="product-campus" v-if="p.campus">{{p.campus}}</span></div></div>
</div></div>
<el-empty v-else description="????"/>
<div class="load-more" v-if="hasMore"><el-button :loading="loading" @click="loadMore" size="large">????</el-button></div>
</div>
</template>
<script setup>
import {ref,onMounted,watch} from "vue";import {useRoute} from "vue-router";import {getProducts} from "../api/products";
const route=useRoute();
const cats=[{label:"??",value:"all"},{label:"??",value:"digital"},{label:"??",value:"books"},{label:"??",value:"life"},{label:"??",value:"clothing"},{label:"??",value:"sports"},{label:"??",value:"beauty"},{label:"??",value:"other"}];
const condMap={brand_new:"??",like_new:"????",used:"??",old:"??"};
const campuses=["???","???","???","???","??"];
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
.category-bar{display:flex;gap:0;overflow-x:auto;padding:12px 16px;background:var(--bg-primary);border-bottom:1px solid var(--border);-webkit-overflow-scrolling:touch;}
.category-bar::-webkit-scrollbar{display:none;}
.category-item{flex-shrink:0;padding:6px 16px;font-size:14px;color:var(--text-secondary);border-radius:20px;cursor:pointer;transition:all 0.2s;white-space:nowrap;}
.category-item.active{background:var(--primary);color:#fff;}
.filter-bar{display:flex;gap:12px;padding:12px 16px;background:var(--bg-primary);}
.product-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;padding:10px 16px;}
@media(min-width:640px){.product-grid{grid-template-columns:repeat(3,1fr);}}
@media(min-width:960px){.product-grid{grid-template-columns:repeat(4,1fr);gap:16px;}}
.product-card{background:var(--bg-primary);border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow);cursor:pointer;transition:transform 0.2s;}
.product-card:hover{transform:translateY(-2px);}
.product-image{position:relative;aspect-ratio:1;overflow:hidden;background:var(--bg-tertiary);}
.product-image img{width:100%;height:100%;object-fit:cover;}
.product-condition{position:absolute;top:6px;left:6px;background:rgba(0,0,0,0.6);color:#fff;font-size:11px;padding:2px 6px;border-radius:4px;}
.product-info{padding:10px;}
.product-title{font-size:14px;font-weight:500;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:6px;}
.product-meta{display:flex;align-items:baseline;gap:6px;margin-bottom:6px;}
.product-price{font-size:16px;font-weight:600;color:var(--danger);}
.product-original{font-size:12px;color:var(--text-tertiary);text-decoration:line-through;}
.product-footer{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--text-tertiary);}
.load-more{text-align:center;padding:20px;}
</style>
