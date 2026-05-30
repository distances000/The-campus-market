<template>
<div class="profile-page" v-if="userStore.isLoggedIn">
    <div class="page-container" style="max-width:760px">
        <div class="profile-card">
            <el-avatar :size="64">{{ (userStore.user?.nickname || "")[0] }}</el-avatar>
            <div class="profile-info">
                <h2>{{ userStore.user?.nickname }}</h2>
                <p v-if="userStore.user?.campus">{{ userStore.user.campus }}</p>
            </div>
            <el-button @click="showEdit=true" size="small" plain>编辑资料</el-button>
        </div>

        <div class="credit-card">
            <div>
                <div class="credit-title">信用系统</div>
                <div class="credit-desc">基于已完成订单的双方评价自动累积</div>
            </div>
            <div class="credit-score-wrap">
                <div class="credit-score">{{ credit.rating_avg.toFixed(1) }}</div>
                <div class="credit-count">{{ credit.review_count }} 条评价</div>
            </div>
        </div>

        <el-dialog v-model="showEdit" title="编辑资料" width="400px">
            <el-form :model="editForm" label-position="top">
                <el-form-item label="昵称"><el-input v-model="editForm.nickname"/></el-form-item>
                <el-form-item label="校区">
                    <el-select v-model="editForm.campus" style="width:100%">
                        <el-option v-for="option in campusOptions" :key="option.value" :label="option.label" :value="option.value"/>
                    </el-select>
                </el-form-item>
                <el-form-item label="个人简介"><el-input v-model="editForm.bio" type="textarea" :rows="3"/></el-form-item>
                <el-form-item label="手机号"><el-input v-model="editForm.phone"/></el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="showEdit=false">取消</el-button>
                <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
            </template>
        </el-dialog>

        <div class="profile-menu">
            <div class="menu-item" :class="{ active: activeTab==='products' }" @click="switchTab('products')"><el-icon><Goods/></el-icon><span>我的商品</span><el-icon><ArrowRight/></el-icon></div>
            <div class="menu-item" :class="{ active: activeTab==='favorites' }" @click="switchTab('favorites')"><el-icon><Star/></el-icon><span>我的收藏</span><el-icon><ArrowRight/></el-icon></div>
            <div class="menu-item" :class="{ active: activeTab==='orders' }" @click="switchTab('orders')"><el-icon><Tickets/></el-icon><span>我的订单</span><el-icon><ArrowRight/></el-icon></div>
            <div class="menu-item" :class="{ active: activeTab==='reviews' }" @click="switchTab('reviews')"><el-icon><Medal/></el-icon><span>收到的评价</span><el-icon><ArrowRight/></el-icon></div>
        </div>

        <div class="tab-content">
            <template v-if="activeTab==='products'">
                <div v-if="myProducts.length>0" class="my-product-list">
                    <div v-for="p in myProducts" :key="p.id" class="my-product-item" @click="$router.push('/product/'+p.id)">
                        <img :src="getImg(p)" class="mp-thumb"/>
                        <div class="mp-info">
                            <div class="mp-top">
                                <div class="mp-title">{{ p.title }}</div>
                                <el-tag :type="getStatusMeta(p.status).type" size="small">{{ getStatusMeta(p.status).label }}</el-tag>
                            </div>
                            <div class="mp-price">&yen;{{ p.price }}</div>
                            <div class="mp-actions">
                                <el-button size="small" plain @click.stop="goEdit(p)">编辑</el-button>
                                <el-button v-if="p.status==='active'" size="small" type="success" plain @click.stop="handleMarkSold(p)">标记售出</el-button>
                                <el-button v-if="p.status==='active'" size="small" type="warning" plain @click.stop="handleTakeDown(p)">下架</el-button>
                                <el-button v-if="p.status==='inactive'" size="small" type="success" plain @click.stop="handleRelist(p)">上架</el-button>
                            </div>
                        </div>
                    </div>
                </div>
                <el-empty v-else description="还没有发布商品"/>
            </template>

            <template v-else-if="activeTab==='favorites'">
                <div v-if="favoriteProducts.length>0" class="my-product-list">
                    <div v-for="p in favoriteProducts" :key="p.id" class="my-product-item" @click="$router.push('/product/'+p.id)">
                        <img :src="getImg(p)" class="mp-thumb"/>
                        <div class="mp-info">
                            <div class="mp-top">
                                <div class="mp-title">{{ p.title }}</div>
                                <el-tag :type="getStatusMeta(p.status).type" size="small">{{ getStatusMeta(p.status).label }}</el-tag>
                            </div>
                            <div class="mp-price">&yen;{{ p.price }}</div>
                            <div class="mp-meta">
                                <span>{{ p.seller_name }}</span>
                                <span v-if="p.campus">{{ p.campus }}</span>
                            </div>
                            <div class="mp-actions">
                                <el-button size="small" type="warning" plain @click.stop="handleUnfavorite(p)">取消收藏</el-button>
                            </div>
                        </div>
                    </div>
                </div>
                <el-empty v-else description="还没有收藏商品"/>
            </template>

            <template v-else-if="activeTab==='orders'">
                <div class="order-filter">
                    <el-select v-model="orderRole" style="width:160px" @change="fetchOrders">
                        <el-option label="全部订单" value="all"/>
                        <el-option label="我买到的" value="buyer"/>
                        <el-option label="我卖出的" value="seller"/>
                    </el-select>
                </div>
                <div v-if="orders.length>0" class="my-product-list">
                    <div v-for="order in orders" :key="order.id" class="my-product-item">
                        <img :src="getImg(order)" class="mp-thumb"/>
                        <div class="mp-info">
                            <div class="mp-top">
                                <div class="mp-title">{{ order.product_title }}</div>
                                <el-tag :type="getOrderMeta(order.status).type" size="small">{{ getOrderMeta(order.status).label }}</el-tag>
                            </div>
                            <div class="mp-price">&yen;{{ order.price_snapshot }}</div>
                            <div class="mp-meta">
                                <span>{{ order.role === "buyer" ? "卖家" : "买家" }}：{{ order.role === "buyer" ? order.seller_name : order.buyer_name }}</span>
                                <span>{{ order.created_at }}</span>
                            </div>
                            <div class="mp-actions">
                                <el-button size="small" plain @click="$router.push('/product/'+order.product_id)">查看商品</el-button>
                                <el-button v-if="order.role==='buyer' && order.status==='pending_completion'" size="small" type="success" plain @click="handleCompleteOrder(order)">确认完成</el-button>
                                <el-button v-if="order.status==='pending_completion'" size="small" type="warning" plain @click="handleCancelOrder(order)">取消订单</el-button>
                                <el-button v-if="order.can_review" size="small" type="primary" plain @click="openReview(order)">评价</el-button>
                            </div>
                        </div>
                    </div>
                </div>
                <el-empty v-else description="还没有订单"/>
            </template>

            <template v-else>
                <div v-if="receivedReviews.length>0" class="review-list">
                    <div v-for="review in receivedReviews" :key="review.id" class="review-item">
                        <div class="review-head">
                            <div>
                                <div class="review-author">{{ review.reviewer_name }}</div>
                                <div class="review-product">来自商品：{{ review.product_title }}</div>
                            </div>
                            <div class="review-rating">{{ "★".repeat(review.rating) }}</div>
                        </div>
                        <div class="review-content">{{ review.content || "对方未填写评价内容" }}</div>
                        <div class="review-time">{{ review.created_at }}</div>
                    </div>
                </div>
                <el-empty v-else description="暂时还没有收到评价"/>
            </template>
        </div>

        <el-dialog v-model="reviewDialogVisible" title="提交评价" width="420px">
            <el-form label-position="top">
                <el-form-item label="评分">
                    <el-rate v-model="reviewForm.rating" :max="5"/>
                </el-form-item>
                <el-form-item label="评价内容">
                    <el-input v-model="reviewForm.content" type="textarea" :rows="4" maxlength="200" show-word-limit placeholder="说说本次交易体验"/>
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="reviewDialogVisible=false">取消</el-button>
                <el-button type="primary" :loading="reviewSubmitting" @click="handleSubmitReview">提交评价</el-button>
            </template>
        </el-dialog>

        <div class="logout-section">
            <el-button type="danger" @click="handleLogout" style="width:100%">退出登录</el-button>
        </div>
    </div>
</div>
</template>
<script setup>
import { computed, ref, reactive, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { useUserStore } from "../stores/user";
import { updateMe } from "../api/auth";
import { getMyProducts, getMyFavorites, updateProduct, toggleFavorite } from "../api/products";
import { completeOrder, cancelOrder, getMyOrders, getReceivedReviews, reviewOrder } from "../api/orders";
import { getProductStatusMeta } from "../utils/product";
import { getOrderStatusMeta } from "../utils/order";
import { CAMPUS_OPTIONS } from "../utils/options";
import { Goods, Star, ArrowRight, Tickets, Medal } from "@element-plus/icons-vue";

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();
const showEdit = ref(false);
const saving = ref(false);
const activeTab = ref("products");
const myProducts = ref([]);
const favoriteProducts = ref([]);
const orders = ref([]);
const receivedReviews = ref([]);
const campusOptions = CAMPUS_OPTIONS;
const orderRole = ref("all");
const reviewDialogVisible = ref(false);
const reviewSubmitting = ref(false);
const currentReviewOrder = ref(null);
const credit = ref({ rating_avg: 0, review_count: 0 });
const editForm = reactive({ nickname: "", campus: "", bio: "", phone: "" });
const reviewForm = reactive({ rating: 5, content: "" });
const defImg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect fill='%23f0f0f0' width='80' height='80'/%3E%3C/svg%3E";

const validTabs = new Set(["products", "favorites", "orders", "reviews"]);

function getImg(p) {
    return (p.images && p.images.length) ? p.images[0] : defImg;
}

function getStatusMeta(status) {
    return getProductStatusMeta(status);
}

function getOrderMeta(status) {
    return getOrderStatusMeta(status);
}

function initEdit() {
    editForm.nickname = userStore.user?.nickname || "";
    editForm.campus = userStore.user?.campus || "";
    editForm.bio = userStore.user?.bio || "";
    editForm.phone = userStore.user?.phone || "";
}

function syncTabFromRoute() {
    const tab = typeof route.query.tab === "string" ? route.query.tab : "products";
    activeTab.value = validTabs.has(tab) ? tab : "products";
}

function switchTab(tab) {
    activeTab.value = tab;
    router.replace({ path: route.path, query: { ...route.query, tab } });
}

async function handleSave() {
    saving.value = true;
    try {
        const r = await updateMe(editForm);
        userStore.updateUser(r.data);
        credit.value = r.data.credit || credit.value;
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

async function fetchMyFavorites() {
    try {
        favoriteProducts.value = (await getMyFavorites()).data.list;
    } catch {}
}

async function fetchOrders() {
    try {
        orders.value = (await getMyOrders({ role: orderRole.value })).data.list;
    } catch {}
}

async function fetchReceivedReviews() {
    try {
        const r = await getReceivedReviews();
        receivedReviews.value = r.data.list;
        credit.value = r.data.credit;
        userStore.updateUser({ credit: r.data.credit });
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

async function handleUnfavorite(p) {
    try {
        await ElMessageBox.confirm(`确认取消收藏《${p.title}》？`, "操作确认", { type: "warning" });
        await toggleFavorite(p.id);
        ElMessage.success("已取消收藏");
        await fetchMyFavorites();
    } catch {}
}

async function handleCompleteOrder(order) {
    try {
        await ElMessageBox.confirm(`确认完成订单《${order.product_title}》？`, "订单确认", { type: "warning" });
        await completeOrder(order.id);
        ElMessage.success("订单已完成");
        await Promise.all([fetchOrders(), fetchMyProducts()]);
    } catch {}
}

async function handleCancelOrder(order) {
    try {
        await ElMessageBox.confirm(`确认取消订单《${order.product_title}》？`, "订单确认", { type: "warning" });
        await cancelOrder(order.id);
        ElMessage.success("订单已取消");
        await Promise.all([fetchOrders(), fetchMyProducts()]);
    } catch {}
}

function openReview(order) {
    currentReviewOrder.value = order;
    reviewForm.rating = 5;
    reviewForm.content = "";
    reviewDialogVisible.value = true;
}

async function handleSubmitReview() {
    if (!currentReviewOrder.value) return;
    reviewSubmitting.value = true;
    try {
        await reviewOrder(currentReviewOrder.value.id, { rating: reviewForm.rating, content: reviewForm.content });
        ElMessage.success("评价成功");
        reviewDialogVisible.value = false;
        await Promise.all([fetchOrders(), fetchReceivedReviews()]);
    } catch {} finally {
        reviewSubmitting.value = false;
    }
}

function handleLogout() {
    userStore.logout();
    router.push("/home");
    ElMessage.success("已退出登录");
}

watch(() => route.query.tab, syncTabFromRoute);
watch(orderRole, fetchOrders);

onMounted(() => {
    syncTabFromRoute();
    credit.value = userStore.user?.credit || { rating_avg: 0, review_count: 0 };
    fetchMyProducts();
    fetchMyFavorites();
    fetchOrders();
    fetchReceivedReviews();
    initEdit();
});
</script>
<style scoped>
.profile-card{background:var(--bg-primary);border-radius:var(--radius);padding:24px;display:flex;align-items:center;gap:16px;margin-bottom:12px;}
.profile-info{flex:1;}.profile-info h2{font-size:18px;font-weight:600;}.profile-info p{font-size:13px;color:var(--text-tertiary);margin-top:4px;}
.credit-card{background:linear-gradient(135deg,#fff7ed,#fff);border-radius:var(--radius);padding:18px 20px;display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border:1px solid #fed7aa;}
.credit-title{font-size:16px;font-weight:700;color:#9a3412;}
.credit-desc{font-size:12px;color:#c2410c;margin-top:4px;}
.credit-score-wrap{text-align:right;}
.credit-score{font-size:30px;font-weight:700;color:#ea580c;}
.credit-count{font-size:12px;color:#9a3412;}
.profile-menu{background:var(--bg-primary);border-radius:var(--radius);margin-bottom:12px;}
.menu-item{display:flex;align-items:center;gap:12px;padding:16px;border-bottom:1px solid var(--bg-tertiary);cursor:pointer;font-size:15px;}
.menu-item.active{color:var(--primary);}
.menu-item:last-child{border-bottom:none;}.menu-item span{flex:1;}
.tab-content{background:var(--bg-primary);border-radius:var(--radius);margin-bottom:12px;padding:16px;}
.my-product-list,.review-list{display:flex;flex-direction:column;gap:12px;}
.my-product-item{display:flex;gap:12px;cursor:pointer;padding:8px;border-radius:var(--radius);transition:background 0.2s;}
.my-product-item:hover{background:var(--bg-tertiary);}
.mp-thumb{width:72px;height:72px;border-radius:6px;object-fit:cover;background:var(--bg-tertiary);flex-shrink:0;}
.mp-info{flex:1;min-width:0;}
.mp-top{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.mp-title{font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.mp-price{font-size:16px;font-weight:600;color:var(--danger);margin:4px 0 6px;}
.mp-meta{display:flex;justify-content:space-between;gap:8px;font-size:12px;color:var(--text-tertiary);margin-bottom:8px;flex-wrap:wrap;}
.mp-actions{display:flex;gap:8px;flex-wrap:wrap;}
.order-filter{display:flex;justify-content:flex-end;margin-bottom:12px;}
.review-item{border:1px solid var(--border);border-radius:10px;padding:14px;}
.review-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;}
.review-author{font-size:14px;font-weight:600;}
.review-product,.review-time{font-size:12px;color:var(--text-tertiary);}
.review-rating{font-size:14px;color:#f59e0b;}
.review-content{font-size:14px;line-height:1.6;margin:10px 0;color:var(--text-secondary);}
.logout-section{padding:20px 0;}
</style>
