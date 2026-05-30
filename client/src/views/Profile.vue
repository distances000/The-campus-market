<template>
<div class="profile-page" v-if="userStore.isLoggedIn">
    <div class="page-container" style="max-width:760px">
        <div class="profile-hero">
            <div class="profile-card">
                <el-avatar :size="72">{{ (userStore.user?.nickname || "")[0] }}</el-avatar>
                <div class="profile-info">
                    <h2>{{ userStore.user?.nickname }}</h2>
                    <p v-if="userStore.user?.campus">{{ userStore.user.campus }}</p>
                    <span class="profile-bio">{{ userStore.user?.bio || "完善资料可以提升交易信任感" }}</span>
                </div>
                <el-button @click="showEdit=true" size="small" plain class="profile-edit-btn">编辑资料</el-button>
            </div>

            <div class="credit-card">
                <div class="credit-main">
                    <div class="credit-eyebrow">信用系统</div>
                    <div class="credit-title">交易信用会随着已完成订单和双方评价持续累积</div>
                    <div class="credit-stats">
                        <div class="credit-stat">
                            <span class="credit-stat-label">信用分</span>
                            <strong class="credit-stat-value">{{ credit.rating_avg.toFixed(1) }}</strong>
                        </div>
                        <div class="credit-stat">
                            <span class="credit-stat-label">累计评价</span>
                            <strong class="credit-stat-value">{{ credit.review_count }}</strong>
                        </div>
                    </div>
                </div>
                <div class="credit-score-wrap">
                    <div class="credit-score-ring">
                        <div class="credit-score">{{ credit.rating_avg.toFixed(1) }}</div>
                    </div>
                    <div class="credit-count">共 {{ credit.review_count }} 条有效评价</div>
                </div>
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

        <div class="profile-tabs">
            <button class="tab-chip" :class="{ active: activeTab==='products' }" @click="switchTab('products')"><el-icon><Goods/></el-icon><span>我的商品</span></button>
            <button class="tab-chip" :class="{ active: activeTab==='favorites' }" @click="switchTab('favorites')"><el-icon><Star/></el-icon><span>我的收藏</span></button>
            <button class="tab-chip" :class="{ active: activeTab==='orders' }" @click="switchTab('orders')"><el-icon><Tickets/></el-icon><span>我的订单</span></button>
            <button class="tab-chip" :class="{ active: activeTab==='reviews' }" @click="switchTab('reviews')"><el-icon><Medal/></el-icon><span>收到评价</span></button>
        </div>

        <div class="tab-content">
            <template v-if="activeTab==='products'">
                <div class="section-head">
                    <div>
                        <div class="section-title">我的商品</div>
                        <div class="section-subtitle">管理在售、下架和售出的商品</div>
                    </div>
                </div>
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
                <div class="section-head">
                    <div>
                        <div class="section-title">我的收藏</div>
                        <div class="section-subtitle">保留你想继续关注或比较的商品</div>
                    </div>
                </div>
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
                <div class="section-head">
                    <div>
                        <div class="section-title">我的订单</div>
                        <div class="section-subtitle">跟踪交易状态，完成后可立即评价</div>
                    </div>
                    <el-select v-model="orderRole" style="width:180px" @change="fetchOrders">
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
                <div class="section-head">
                    <div>
                        <div class="section-title">收到的评价</div>
                        <div class="section-subtitle">这些评价会直接影响你的公开信用展示</div>
                    </div>
                </div>
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
.profile-page {
    padding-top: 8px;
}

.profile-hero {
    background:
        radial-gradient(circle at top left, rgba(65, 95, 145, 0.18), transparent 34%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(248, 250, 255, 0.95));
    border-radius: 32px;
    padding: 24px;
    border: 1px solid rgba(194, 199, 208, 0.24);
    box-shadow: var(--shadow-lg);
    margin-bottom: 18px;
    backdrop-filter: blur(14px);
}

.profile-card {
    display: flex;
    align-items: center;
    gap: 18px;
    margin-bottom: 18px;
}

.profile-info {
    flex: 1;
    min-width: 0;
}

.profile-info h2 {
    font-size: 28px;
    font-weight: 700;
    letter-spacing: 0.01em;
}

.profile-info p {
    font-size: 13px;
    color: var(--primary);
    margin-top: 8px;
    font-weight: 700;
}

.profile-bio {
    display: block;
    font-size: 14px;
    color: var(--text-secondary);
    margin-top: 12px;
    line-height: 1.7;
    max-width: 440px;
}

.profile-edit-btn {
    align-self: flex-start;
}

.credit-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 24px;
    background: rgba(232, 238, 249, 0.66);
    border-radius: 28px;
    padding: 22px 24px;
    border: 1px solid rgba(194, 199, 208, 0.18);
}

.credit-main {
    flex: 1;
}

.credit-eyebrow {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--primary);
    text-transform: uppercase;
    margin-bottom: 10px;
}

.credit-title {
    font-size: 18px;
    font-weight: 700;
    line-height: 1.5;
    color: var(--text-primary);
    max-width: 460px;
}

.credit-stats {
    display: flex;
    gap: 32px;
    margin-top: 18px;
}

.credit-stat {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.credit-stat-label {
    font-size: 12px;
    color: var(--text-tertiary);
}

.credit-stat-value {
    font-size: 24px;
    font-weight: 700;
    color: var(--primary-dark);
}

.credit-score-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    min-width: 132px;
}

.credit-score-ring {
    width: 108px;
    height: 108px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background:
        radial-gradient(circle at center, rgba(252, 248, 255, 1) 56%, transparent 57%),
        conic-gradient(var(--primary) 0deg, #8aa6da 250deg, rgba(65, 95, 145, 0.10) 250deg);
    box-shadow: inset 0 0 0 1px rgba(65, 95, 145, 0.08);
}

.credit-score {
    font-size: 30px;
    font-weight: 800;
    color: var(--primary-dark);
}

.credit-count {
    font-size: 12px;
    color: var(--text-secondary);
}

.profile-tabs {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 16px;
}

.tab-chip {
    border: none;
    background: rgba(232, 238, 249, 0.9);
    color: var(--text-secondary);
    border-radius: 999px;
    padding: 11px 18px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
}

.tab-chip.active {
    background: var(--chip-active);
    color: var(--primary);
    box-shadow: inset 0 0 0 1px rgba(65, 95, 145, 0.14);
}

.tab-content {
    background: rgba(255, 255, 255, 0.88);
    border-radius: 30px;
    margin-bottom: 16px;
    padding: 20px;
    border: 1px solid rgba(194, 199, 208, 0.22);
    box-shadow: var(--shadow);
}

.section-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    flex-wrap: wrap;
}

.section-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--text-primary);
}

.section-subtitle {
    font-size: 13px;
    color: var(--text-tertiary);
    margin-top: 6px;
    line-height: 1.6;
}

.my-product-list,
.review-list {
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.my-product-item {
    display: flex;
    gap: 14px;
    cursor: pointer;
    padding: 14px;
    border-radius: 24px;
    border: 1px solid rgba(194, 199, 208, 0.18);
    background: rgba(240, 242, 248, 0.54);
    transition: transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
}

.my-product-item:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
    background: rgba(245, 247, 252, 0.94);
}

.mp-thumb {
    width: 84px;
    height: 84px;
    border-radius: 20px;
    object-fit: cover;
    background: var(--bg-tertiary);
    flex-shrink: 0;
}

.mp-info {
    flex: 1;
    min-width: 0;
}

.mp-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
}

.mp-title {
    font-size: 16px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--text-primary);
}

.mp-price {
    font-size: 20px;
    font-weight: 700;
    color: var(--danger);
    margin: 10px 0 8px;
}

.mp-meta {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 12px;
    color: var(--text-tertiary);
    margin-bottom: 10px;
    flex-wrap: wrap;
}

.mp-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.review-item {
    border: 1px solid rgba(194, 199, 208, 0.18);
    border-radius: 24px;
    padding: 18px;
    background: rgba(240, 242, 248, 0.48);
}

.review-head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
}

.review-author {
    font-size: 15px;
    font-weight: 700;
}

.review-product,
.review-time {
    font-size: 12px;
    color: var(--text-tertiary);
}

.review-rating {
    font-size: 15px;
    color: #f2a21b;
    font-weight: 700;
}

.review-content {
    font-size: 14px;
    line-height: 1.8;
    margin: 12px 0 10px;
    color: var(--text-secondary);
}

.logout-section {
    padding: 12px 0 20px;
}

@media (max-width: 640px) {
    .profile-hero {
        padding: 18px;
        border-radius: 28px;
    }

    .profile-card {
        align-items: flex-start;
        flex-wrap: wrap;
    }

    .credit-card {
        flex-direction: column;
        align-items: flex-start;
        border-radius: 24px;
    }

    .credit-score-wrap {
        width: 100%;
        flex-direction: row;
        justify-content: space-between;
    }

    .credit-score-ring {
        width: 92px;
        height: 92px;
    }

    .mp-top {
        align-items: flex-start;
        flex-direction: column;
    }
}
</style>
