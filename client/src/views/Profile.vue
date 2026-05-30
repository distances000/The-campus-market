<template>
<div class="profile-page" v-if="userStore.isLoggedIn"><div class="page-container" style="max-width:600px">
<div class="profile-card"><el-avatar :size="64">{{(userStore.user?.nickname||"")[0]}}</el-avatar><div class="profile-info"><h2>{{userStore.user?.nickname}}</h2><p v-if="userStore.user?.campus">{{userStore.user.campus}}</p></div><el-button @click="showEdit=true" size="small" plain>编辑资料</el-button></div>
<el-dialog v-model="showEdit" title="编辑资料" width="400px"><el-form :model="editForm" label-position="top">
<el-form-item label="昵称"><el-input v-model="editForm.nickname"/></el-form-item>
<el-form-item label="校区"><el-select v-model="editForm.campus" style="width:100%"><el-option label="校区A" value="校区A"/><el-option label="校区B" value="校区B"/><el-option label="校区C" value="校区C"/><el-option label="校区D" value="校区D"/><el-option label="其他" value="其他"/></el-select></el-form-item>
<el-form-item label="个人简介"><el-input v-model="editForm.bio" type="textarea" :rows="3"/></el-form-item>
<el-form-item label="手机号"><el-input v-model="editForm.phone"/></el-form-item>
</el-form><template #footer><el-button @click="showEdit=false">取消</el-button><el-button type="primary" :loading="saving" @click="handleSave">保存</el-button></template></el-dialog>
<div class="profile-menu"><div class="menu-item" @click="activeTab='products'"><el-icon><Goods/></el-icon><span>我的商品</span><el-icon><ArrowRight/></el-icon></div><div class="menu-item" @click="activeTab='favorites'"><el-icon><Star/></el-icon><span>我的收藏</span><el-icon><ArrowRight/></el-icon></div></div>
<div class="tab-content"><div v-if="activeTab==='products'"><div v-if="myProducts.length>0" class="my-product-list"><div v-for="p in myProducts" :key="p.id" class="my-product-item" @click="$router.push('/product/'+p.id)"><img :src="getImg(p)" class="mp-thumb"/><div class="mp-info"><div class="mp-top"><div class="mp-title">{{p.title}}</div><el-tag :type="getStatusMeta(p.status).type" size="small">{{getStatusMeta(p.status).label}}</el-tag></div><div class="mp-price">&yen;{{p.price}}</div><div class="mp-actions"><el-button size="small" plain @click.stop="goEdit(p)">编辑</el-button><el-button v-if="p.status==='active'" size="small" type="success" plain @click.stop="handleMarkSold(p)">标记售出</el-button><el-button v-if="p.status==='active'" size="small" type="warning" plain @click.stop="handleTakeDown(p)">下架</el-button><el-button v-if="p.status==='inactive'" size="small" type="success" plain @click.stop="handleRelist(p)">上架</el-button></div></div></div></div><el-empty v-else description="还没有发布商品"/></div><div v-else><el-empty description="收藏功能正在完善中..."/></div></div>
<div class="logout-section"><el-button type="danger" @click="handleLogout" style="width:100%">退出登录</el-button></div>
</div></div>
</template>
<script setup>
import { ref, reactive, onMounted } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { useUserStore } from "../stores/user";
import { updateMe } from "../api/auth";
import { getMyProducts, updateProduct } from "../api/products";
import { getProductStatusMeta } from "../utils/product";
import { Goods, Star, ArrowRight } from "@element-plus/icons-vue";

const router = useRouter();
const userStore = useUserStore();
const showEdit = ref(false);
const saving = ref(false);
const activeTab = ref("products");
const myProducts = ref([]);
const editForm = reactive({ nickname: "", campus: "", bio: "", phone: "" });
const defImg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect fill='%23f0f0f0' width='80' height='80'/%3E%3C/svg%3E";

function getImg(p) {
    return (p.images && p.images.length) ? p.images[0] : defImg;
}

function getStatusMeta(status) {
    return getProductStatusMeta(status);
}

function initEdit() {
    editForm.nickname = userStore.user?.nickname || "";
    editForm.campus = userStore.user?.campus || "";
    editForm.bio = userStore.user?.bio || "";
    editForm.phone = userStore.user?.phone || "";
}

async function handleSave() {
    saving.value = true;
    try {
        const r = await updateMe(editForm);
        userStore.updateUser(r.data);
        ElMessage.success("保存成功");
        showEdit.value = false;
    } catch {} finally {
        saving.value = false;
    }
}

async function fetchMyProducts() {
    try {
        myProducts.value = (await getMyProducts()).data.list;
    } catch {}
}

function goEdit(p) {
    router.push("/publish/" + p.id);
}

async function handleMarkSold(p) {
    try {
        await ElMessageBox.confirm(`确认将《${p.title}》标记为售出？`, "操作确认", { type: "warning" });
        await updateProduct(p.id, { status: "sold" });
        ElMessage.success("已标记为售出");
        await fetchMyProducts();
    } catch {}
}

async function handleTakeDown(p) {
    try {
        await ElMessageBox.confirm(`确认将《${p.title}》下架？`, "操作确认", { type: "warning" });
        await updateProduct(p.id, { status: "inactive" });
        ElMessage.success("已下架");
        await fetchMyProducts();
    } catch {}
}

async function handleRelist(p) {
    try {
        await ElMessageBox.confirm(`确认将《${p.title}》重新上架？`, "操作确认", { type: "warning" });
        await updateProduct(p.id, { status: "active" });
        ElMessage.success("已上架");
        await fetchMyProducts();
    } catch {}
}

function handleLogout() {
    userStore.logout();
    router.push("/home");
    ElMessage.success("已退出登录");
}

onMounted(() => {
    fetchMyProducts();
    initEdit();
});
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
.mp-info{flex:1;min-width:0;}
.mp-top{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.mp-title{font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.mp-price{font-size:16px;font-weight:600;color:var(--danger);margin:4px 0 8px;}
.mp-actions{display:flex;gap:8px;flex-wrap:wrap;}
.logout-section{padding:20px 0;}
</style>
