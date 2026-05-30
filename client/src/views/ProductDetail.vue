<template>
<div class="detail-page"><div class="page-container" style="max-width:800px" v-if="product">
<div class="detail-images" v-if="product.images&&product.images.length"><el-carousel height="400px" indicator-position="none"><el-carousel-item v-for="(img,i) in product.images" :key="i"><img :src="img" class="detail-main-image"/></el-carousel-item></el-carousel></div>
<div class="detail-images detail-images-empty" v-else><div class="no-image"><el-icon :size="48"><Picture/></el-icon><span>????</span></div></div>
<div class="detail-header"><div class="detail-price">&yen;{{product.price}}</div><div class="detail-original" v-if="product.original_price">?? &yen;{{product.original_price}}</div><h1 class="detail-title">{{product.title}}</h1><div class="detail-meta"><el-tag size="small">{{condMap[product.condition]||product.condition}}</el-tag><el-tag size="small" type="info">{{catMap[product.category]||product.category}}</el-tag><span>{{product.views}}???</span><span>{{product.created_at}}</span></div></div>
<div class="detail-seller"><el-avatar :size="40">{{(product.seller_name||"")[0]}}</el-avatar><div class="seller-info"><div class="seller-name">{{product.seller_name}}</div><div class="seller-campus" v-if="product.campus">{{product.campus}}</div></div><el-button type="primary" @click="$router.push('/chat/'+product.seller_id)" v-if="userStore.user?.id!==product.seller_id">????</el-button></div>
<div class="detail-section" v-if="product.description"><h3>????</h3><p>{{product.description}}</p></div>
<div class="detail-actions"><el-button :type="product.is_favorited?'warning':'default'" size="large" @click="handleFavorite" :disabled="!userStore.isLoggedIn"><el-icon><Star/></el-icon>{{product.is_favorited?'???':'??'}}</el-button><el-button type="primary" size="large" @click="$router.push('/chat/'+product.seller_id)" v-if="userStore.isLoggedIn&&userStore.user?.id!==product.seller_id">????</el-button><template v-if="userStore.user?.id===product.seller_id"><el-button size="large" @click="handleDelete" type="danger">??</el-button></template></div>
</div><div class="page-container" v-else-if="!loading"><el-empty description="?????"/></div></div>
</template>
<script setup>
import {ref,onMounted} from "vue";import {useRoute,useRouter} from "vue-router";import {ElMessage,ElMessageBox} from "element-plus";import {useUserStore} from "../stores/user";import {getProduct,deleteProduct,toggleFavorite} from "../api/products";
import { Picture, Star } from "@element-plus/icons-vue";
const route=useRoute(),router=useRouter(),userStore=useUserStore(),product=ref(null),loading=ref(true);
const condMap={brand_new:"??",like_new:"????",used:"??",old:"??"};
const catMap={digital:"??",books:"??",life:"??",clothing:"??",sports:"??",beauty:"??",other:"??"};
async function fetchProduct(){loading.value=true;try{product.value=(await getProduct(route.params.id)).data;}catch{product.value=null;}finally{loading.value=false;}}
async function handleFavorite(){if(!userStore.isLoggedIn){ElMessage.warning("????");return;}try{const r=await toggleFavorite(product.value.id);product.value.is_favorited=r.data.favorited;ElMessage.success(r.message);}catch{}}
async function handleDelete(){try{await ElMessageBox.confirm("?????????","??",{type:"warning"});await deleteProduct(product.value.id);ElMessage.success("????");router.push("/home");}catch{}}
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
.detail-title{font-size:18px;font-weight:600;margin-bottom:10px;}
.detail-meta{display:flex;gap:10px;align-items:center;font-size:12px;color:var(--text-tertiary);flex-wrap:wrap;}
.detail-seller{background:var(--bg-primary);padding:16px 20px;border-radius:var(--radius);display:flex;align-items:center;gap:12px;margin-bottom:12px;}
.seller-info{flex:1;}.seller-name{font-weight:500;}.seller-campus{font-size:12px;color:var(--text-tertiary);}
.detail-section{background:var(--bg-primary);padding:20px;border-radius:var(--radius);margin-bottom:12px;}
.detail-section h3{font-size:15px;font-weight:600;margin-bottom:10px;}
.detail-section p{font-size:14px;line-height:1.7;color:var(--text-secondary);white-space:pre-wrap;}
.detail-actions{background:var(--bg-primary);padding:16px 20px;border-radius:var(--radius);display:flex;gap:12px;position:sticky;bottom:64px;}
</style>
