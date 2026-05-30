<template>
<div class="profile-page" v-if="userStore.isLoggedIn"><div class="page-container" style="max-width:600px">
<div class="profile-card"><el-avatar :size="64">{{(userStore.user?.nickname||"")[0]}}</el-avatar><div class="profile-info"><h2>{{userStore.user?.nickname}}</h2><p v-if="userStore.user?.campus">{{userStore.user.campus}}</p></div><el-button @click="showEdit=true" size="small" plain>????</el-button></div>
<el-dialog v-model="showEdit" title="????" width="400px"><el-form :model="editForm" label-position="top">
<el-form-item label="??"><el-input v-model="editForm.nickname"/></el-form-item>
<el-form-item label="??"><el-select v-model="editForm.campus" style="width:100%"><el-option label="???" value="???"/><el-option label="???" value="???"/><el-option label="???" value="???"/><el-option label="???" value="???"/><el-option label="??" value="??"/></el-select></el-form-item>
<el-form-item label="????"><el-input v-model="editForm.bio" type="textarea" :rows="3"/></el-form-item>
<el-form-item label="???"><el-input v-model="editForm.phone"/></el-form-item>
</el-form><template #footer><el-button @click="showEdit=false">??</el-button><el-button type="primary" :loading="saving" @click="handleSave">??</el-button></template></el-dialog>
<div class="profile-menu"><div class="menu-item" @click="activeTab='products'"><el-icon><Goods/></el-icon><span>??????</span><el-icon><ArrowRight/></el-icon></div><div class="menu-item" @click="activeTab='favorites'"><el-icon><Star/></el-icon><span>????</span><el-icon><ArrowRight/></el-icon></div></div>
<div class="tab-content"><div v-if="activeTab==='products'"><div v-if="myProducts.length>0" class="my-product-list"><div v-for="p in myProducts" :key="p.id" class="my-product-item" @click="$router.push('/product/'+p.id)"><img :src="getImg(p)" class="mp-thumb"/><div class="mp-info"><div class="mp-title">{{p.title}}</div><div class="mp-price">&yen;{{p.price}}</div><div class="mp-status"><el-tag :type="p.status==='active'?'success':'info'" size="small">{{p.status==='active'?'??':p.status==='sold'?'??':'???'}}</el-tag></div></div></div></div><el-empty v-else description="????"/></div><div v-else><el-empty description="???????..."/></div></div>
<div class="logout-section"><el-button type="danger" @click="handleLogout" style="width:100%">????</el-button></div>
</div></div>
</template>
<script setup>
import {ref,reactive,onMounted} from "vue";import {useRouter} from "vue-router";import {ElMessage} from "element-plus";import {useUserStore} from "../stores/user";import {updateMe} from "../api/auth";import {getMyProducts} from "../api/products";
import { Goods, Star, ArrowRight } from "@element-plus/icons-vue";
const router=useRouter(),userStore=useUserStore(),showEdit=ref(false),saving=ref(false),activeTab=ref("products"),myProducts=ref([]);
const editForm=reactive({nickname:"",campus:"",bio:"",phone:""});
const defImg="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect fill='%23f0f0f0' width='80' height='80'/%3E%3C/svg%3E";
function getImg(p){return(p.images&&p.images.length)?p.images[0]:defImg;}
function initEdit(){editForm.nickname=userStore.user?.nickname||"";editForm.campus=userStore.user?.campus||"";editForm.bio=userStore.user?.bio||"";editForm.phone=userStore.user?.phone||"";}
async function handleSave(){saving.value=true;try{const r=await updateMe(editForm);userStore.updateUser(r.data);ElMessage.success("????");showEdit.value=false;}catch{}finally{saving.value=false;}}
async function fetchMyProducts(){try{myProducts.value=(await getMyProducts()).data.list;}catch{}}
function handleLogout(){userStore.logout();router.push("/home");ElMessage.success("???");}
onMounted(()=>{fetchMyProducts();initEdit();});
</script>
<style scoped>
.profile-card{background:var(--bg-primary);border-radius:var(--radius);padding:24px;display:flex;align-items:center;gap:16px;margin-bottom:12px;}
.profile-info{flex:1;}.profile-info h2{font-size:18px;font-weight:600;}.profile-info p{font-size:13px;color:var(--text-tertiary);margin-top:4px;}
.profile-menu{background:var(--bg-primary);border-radius:var(--radius);margin-bottom:12px;}
.menu-item{display:flex;align-items:center;gap:12px;padding:16px;border-bottom:1px solid var(--bg-tertiary);cursor:pointer;font-size:15px;}
.menu-item:last-child{border-bottom:none;}.menu-item span{flex:1;}
.tab-content{background:var(--bg-primary);border-radius:var(--radius);margin-bottom:12px;padding:16px;}
.my-product-list{display:flex;flex-direction:column;gap:12px;}
.my-product-item{display:flex;gap:12px;cursor:pointer;padding:8px;border-radius:var(--radius);transition:background 0.2s;}
.my-product-item:hover{background:var(--bg-tertiary);}
.mp-thumb{width:72px;height:72px;border-radius:6px;object-fit:cover;background:var(--bg-tertiary);flex-shrink:0;}
.mp-info{flex:1;min-width:0;}.mp-title{font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.mp-price{font-size:16px;font-weight:600;color:var(--danger);margin:4px 0;}
.logout-section{padding:20px 0;}
</style>
