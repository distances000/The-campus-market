<template>
<div class="profile-page" v-if="userStore.isLoggedIn">
    <div class="page-container" style="max-width: 680px">
        <section class="profile-hero">
            <div class="profile-card">
                <div class="avatar-wrap">
                    <el-avatar :size="76">{{ (userStore.user?.nickname || userStore.user?.username || "")[0] }}</el-avatar>
                </div>
                <div class="profile-info">
                    <div class="profile-eyebrow">个人中心</div>
                    <h2>{{ userStore.user?.nickname || userStore.user?.username }}</h2>
                    <p v-if="userStore.user?.campus">{{ userStore.user.campus }}</p>
                    <span class="profile-meta">{{ userStore.user?.bio || "完善资料可以提升交易信任感" }}</span>
                </div>
                <div class="profile-actions">
                    <el-button size="small" plain @click="showEdit=true">编辑资料</el-button>
                    <el-button size="small" plain @click="showPasswordDialog=true">修改密码</el-button>
                </div>
            </div>

            <div class="profile-admin-actions">
                <el-button
                    v-if="userStore.user?.is_admin"
                    size="small"
                    type="primary"
                    @click="goAdminReports"
                >
                    进入管理后台
                </el-button>
                <el-button
                    v-else
                    size="small"
                    type="warning"
                    plain
                    :loading="bootstrappingAdmin"
                    @click="handleBootstrapAdmin"
                >
                    初始化管理员
                </el-button>
            </div>

            <div class="profile-highlights">
                <div class="highlight-card">
                    <span class="highlight-label">我的商品</span>
                    <strong class="highlight-value">{{ myProducts.length }}</strong>
                </div>
                <div class="highlight-card">
                    <span class="highlight-label">我的收藏</span>
                    <strong class="highlight-value">{{ favoriteProducts.length }}</strong>
                </div>
            </div>
        </section>

        <el-dialog v-model="showEdit" title="编辑资料" width="420px">
            <el-form :model="editForm" label-position="top">
                <el-form-item label="昵称">
                    <el-input v-model="editForm.nickname"/>
                </el-form-item>
                <el-form-item label="校区">
                    <el-select v-model="editForm.campus" style="width: 100%">
                        <el-option
                            v-for="option in campusOptions"
                            :key="option.value"
                            :label="option.label"
                            :value="option.value"
                        />
                    </el-select>
                </el-form-item>
                <el-form-item label="个人简介">
                    <el-input v-model="editForm.bio" type="textarea" :rows="3"/>
                </el-form-item>
                <el-form-item label="手机号">
                    <el-input v-model="editForm.phone"/>
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="showEdit=false">取消</el-button>
                <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
            </template>
        </el-dialog>

        <el-dialog v-model="showPasswordDialog" title="修改密码" width="420px" @closed="resetPasswordFormState">
            <el-form :model="passwordForm" label-position="top">
                <el-form-item label="当前密码">
                    <el-input
                        v-model="passwordForm.currentPassword"
                        type="password"
                        show-password
                        autocomplete="current-password"
                    />
                </el-form-item>
                <el-form-item label="新密码">
                    <el-input
                        v-model="passwordForm.newPassword"
                        type="password"
                        show-password
                        autocomplete="new-password"
                    />
                </el-form-item>
                <el-form-item label="确认新密码">
                    <el-input
                        v-model="passwordForm.confirmPassword"
                        type="password"
                        show-password
                        autocomplete="new-password"
                    />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="showPasswordDialog=false">取消</el-button>
                <el-button type="primary" :loading="passwordSaving" @click="handleResetPassword">确认修改</el-button>
            </template>
        </el-dialog>

        <div class="profile-tabs">
            <button type="button" class="tab-chip" :class="{ active: activeTab==='products' }" @click="activeTab='products'">
                <el-icon><Goods/></el-icon>
                <span>我的商品</span>
            </button>
            <button type="button" class="tab-chip" :class="{ active: activeTab==='favorites' }" @click="activeTab='favorites'">
                <el-icon><Star/></el-icon>
                <span>我的收藏</span>
            </button>
        </div>

        <section class="content-card">
            <div class="content-head">
                <div>
                    <div class="content-title">{{ activeTab === "products" ? "我的商品" : "我的收藏" }}</div>
                    <div class="content-subtitle">{{ activeTab === "products" ? "管理你发布的商品状态与编辑入口" : "查看并整理你关注过的商品" }}</div>
                </div>
            </div>

            <div class="tab-content">
            <div v-if="activeTab==='products'">
                <div v-if="myProducts.length>0" class="my-product-list">
                    <div v-for="p in myProducts" :key="p.id" class="my-product-item" @click="$router.push('/product/' + p.id)">
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
                <el-empty v-else description="还没有发布商品" :image-size="88"/>
            </div>

            <div v-else>
                <div v-if="favoriteProducts.length>0" class="my-product-list">
                    <div v-for="p in favoriteProducts" :key="p.id" class="my-product-item" @click="$router.push('/product/' + p.id)">
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
                <el-empty v-else description="还没有收藏商品" :image-size="88"/>
            </div>
            </div>
        </section>

        <div class="logout-section">
            <el-button type="danger" @click="handleLogout" style="width: 100%">退出登录</el-button>
        </div>
    </div>
</div>
</template>

<script setup>
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "../utils/message";
import { Goods, Star } from "../components/element-icons";
import { useUserStore } from "../stores/user";
import { resetPassword, updateMe } from "../api/auth";
import { bootstrapAdmin } from "../api/reports";
import { getMyFavorites, getMyProducts, toggleFavorite, updateProduct } from "../api/products";
import { getProductStatusMeta } from "../utils/product";
import { CAMPUS_OPTIONS } from "../utils/options";

const router = useRouter();
const userStore = useUserStore();
const showEdit = ref(false);
const showPasswordDialog = ref(false);
const saving = ref(false);
const passwordSaving = ref(false);
const activeTab = ref("products");
const myProducts = ref([]);
const favoriteProducts = ref([]);
const bootstrappingAdmin = ref(false);
const campusOptions = CAMPUS_OPTIONS;
const editForm = reactive({ nickname: "", campus: "", bio: "", phone: "" });
const passwordForm = reactive({ currentPassword: "", newPassword: "", confirmPassword: "" });
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

function resetPasswordFormState() {
    passwordForm.currentPassword = "";
    passwordForm.newPassword = "";
    passwordForm.confirmPassword = "";
}

function goAdminReports() {
    router.push("/admin/reports");
}

async function handleSave() {
    saving.value = true;
    try {
        const response = await updateMe(editForm);
        userStore.updateUser(response.data);
        ElMessage.success("资料保存成功");
        showEdit.value = false;
    } catch {} finally {
        saving.value = false;
    }
}

async function handleResetPassword() {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
        ElMessage.warning("请填写完整的密码信息");
        return;
    }
    if (passwordForm.newPassword.length < 6) {
        ElMessage.warning("新密码至少需要 6 位");
        return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        ElMessage.warning("两次输入的新密码不一致");
        return;
    }
    passwordSaving.value = true;
    try {
        await resetPassword(passwordForm.currentPassword, passwordForm.newPassword);
        ElMessage.success("密码修改成功");
        showPasswordDialog.value = false;
        resetPasswordFormState();
    } catch {} finally {
        passwordSaving.value = false;
    }
}

async function handleBootstrapAdmin() {
    try {
        await ElMessageBox.confirm("仅在系统还没有管理员时可初始化当前账号为管理员。是否继续？", "管理员初始化", {
            type: "warning"
        });
    } catch {
        return;
    }

    bootstrappingAdmin.value = true;
    try {
        const response = await bootstrapAdmin();
        userStore.setAuth(response.data.token, response.data.user);
        ElMessage.success("管理员初始化成功");
        router.push("/admin/reports");
    } catch {
    } finally {
        bootstrappingAdmin.value = false;
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
        ElMessage.success("已重新上架");
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

function handleLogout() {
    userStore.logout();
    router.push("/home");
    ElMessage.success("已退出登录");
}

onMounted(() => {
    fetchMyProducts();
    fetchMyFavorites();
    initEdit();
});
</script>

<style scoped>
.profile-page {
    padding-top: 8px;
}

.profile-hero {
    margin-bottom: 16px;
    padding: 22px;
    border-radius: 32px;
    background:
        radial-gradient(circle at top right, rgba(214, 227, 255, 0.66), transparent 28%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(248, 250, 255, 0.96));
    border: 1px solid rgba(194, 199, 208, 0.24);
    box-shadow: var(--shadow-lg);
}

.profile-card {
    display: flex;
    align-items: center;
    gap: 18px;
    margin-bottom: 18px;
}

.avatar-wrap {
    flex-shrink: 0;
}

.profile-info {
    flex: 1;
    min-width: 0;
}

.profile-info h2 {
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.02em;
}

.profile-eyebrow {
    margin-bottom: 6px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--primary);
}

.profile-info p {
    font-size: 13px;
    color: var(--primary);
    margin-top: 6px;
    font-weight: 700;
}

.profile-meta {
    display: block;
    margin-top: 10px;
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.6;
    max-width: 360px;
}

.profile-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
    align-self: flex-start;
}

.profile-admin-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
    margin-top: 10px;
}

.profile-highlights {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
}

.highlight-card {
    padding: 16px 18px;
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.78);
    border: 1px solid rgba(194, 199, 208, 0.2);
    box-shadow: var(--shadow);
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.highlight-label {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-tertiary);
}

.highlight-value {
    font-size: 30px;
    line-height: 1;
    color: var(--primary);
}

.profile-tabs {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 12px;
}

.tab-chip {
    appearance: none;
    -webkit-appearance: none;
    border: none;
    background: rgba(232, 238, 249, 0.9);
    border-radius: 999px;
    padding: 11px 18px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    color: var(--text-secondary);
    font-size: 14px;
    font-weight: 700;
    transition: all 0.2s ease;
}

.tab-chip.active {
    background: rgba(255, 255, 255, 0.96);
    color: var(--primary);
    box-shadow: var(--shadow);
}

.content-card {
    background: rgba(255, 255, 255, 0.9);
    border-radius: 32px;
    padding: 20px;
    border: 1px solid rgba(194, 199, 208, 0.2);
    box-shadow: var(--shadow);
    margin-bottom: 12px;
}

.content-head {
    margin-bottom: 14px;
}

.content-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--text-primary);
}

.content-subtitle {
    margin-top: 6px;
    font-size: 12px;
    color: var(--text-tertiary);
    line-height: 1.6;
}

.tab-content {
    min-height: 320px;
}

.my-product-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.my-product-item {
    display: flex;
    gap: 14px;
    cursor: pointer;
    padding: 12px;
    border-radius: 24px;
    border: 1px solid rgba(194, 199, 208, 0.18);
    background: rgba(240, 242, 248, 0.52);
    transition: transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
}

.my-product-item:hover {
    background: rgba(245, 247, 252, 0.94);
    box-shadow: var(--shadow-md);
    transform: translateY(-1px);
}

.mp-thumb {
    width: 76px;
    height: 76px;
    border-radius: 18px;
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
    gap: 8px;
}

.mp-title {
    font-size: 15px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.mp-price {
    font-size: 18px;
    font-weight: 700;
    color: var(--danger);
    margin: 8px 0 8px;
}

.mp-meta {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 12px;
    color: var(--text-tertiary);
    margin-bottom: 8px;
    flex-wrap: wrap;
}

.mp-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.logout-section {
    padding: 20px 0;
}

@media (max-width: 640px) {
    .profile-hero,
    .content-card {
        border-radius: 26px;
    }

    .profile-card {
        align-items: flex-start;
        flex-wrap: wrap;
    }

    .profile-info h2 {
        font-size: 24px;
    }

    .profile-actions {
        width: 100%;
        justify-content: flex-start;
    }

    .profile-admin-actions {
        justify-content: flex-start;
    }

    .profile-highlights {
        grid-template-columns: 1fr;
    }
}
</style>
