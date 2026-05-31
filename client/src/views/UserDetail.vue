<template>
    <div class="user-detail-page">
        <div v-if="profile" class="page-container user-detail-container">
            <section class="user-hero">
                <div class="user-main-card">
                    <el-avatar :size="82">{{ (profile.nickname || profile.username || "")[0] }}</el-avatar>
                    <div class="user-main-info">
                        <div class="user-eyebrow">用户资料</div>
                        <h2>{{ profile.nickname || profile.username }}</h2>
                        <div class="user-account">@{{ profile.username }}</div>
                        <div class="user-meta-row">
                            <span v-if="profile.campus">{{ profile.campus }}</span>
                            <span>加入时间 {{ formatDate(profile.created_at) }}</span>
                        </div>
                        <p class="user-bio">{{ profile.bio || "这个用户还没有填写个人介绍。" }}</p>
                    </div>
                    <div class="user-actions">
                        <el-button v-if="canChat" type="primary" @click="goChat">发消息</el-button>
                        <el-button v-if="canAddFriend" plain @click="handleAddFriend">添加好友</el-button>
                        <el-button v-if="canRemoveFriend" type="danger" plain @click="handleRemoveFriend">删除好友</el-button>
                    </div>
                </div>

                <div class="user-stat-grid">
                    <div class="stat-card">
                        <span class="stat-label">好友数</span>
                        <strong class="stat-value">{{ profile.friend_count || 0 }}</strong>
                    </div>
                    <div class="stat-card">
                        <span class="stat-label">发布商品</span>
                        <strong class="stat-value">{{ profile.product_count || 0 }}</strong>
                    </div>
                    <div class="stat-card">
                        <span class="stat-label">在售商品</span>
                        <strong class="stat-value">{{ profile.active_product_count || 0 }}</strong>
                    </div>
                    <div class="stat-card">
                        <span class="stat-label">信用评分</span>
                        <strong class="stat-value">{{ profile.credit?.rating_avg || 0 }}</strong>
                    </div>
                </div>
            </section>

            <section class="detail-card">
                <div class="detail-title">交易信用</div>
                <div class="detail-value">
                    基于 {{ profile.credit?.review_count || 0 }} 条评价，当前平均分 {{ profile.credit?.rating_avg || 0 }}
                </div>
            </section>
        </div>

        <div v-else-if="!loading" class="page-container user-detail-container">
            <el-empty description="用户不存在或已不可访问" />
        </div>
    </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "../utils/message";
import { addFriend, getUserProfile, removeFriend } from "../api/messages";
import { useUserStore } from "../stores/user";

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

const loading = ref(true);
const profile = ref(null);

const isSelf = computed(() => Number(route.params.id) === userStore.user?.id);
const canChat = computed(() => !!profile.value && !isSelf.value);
const canAddFriend = computed(() => !!profile.value && !isSelf.value && !profile.value.is_friend);
const canRemoveFriend = computed(() => !!profile.value && !isSelf.value && !!profile.value.is_friend);

function formatDate(value) {
    if (!value) {
        return "-";
    }
    return new Date(value).toLocaleDateString("zh-CN");
}

async function fetchProfile() {
    loading.value = true;
    try {
        profile.value = (await getUserProfile(route.params.id)).data;
    } catch {
        profile.value = null;
    } finally {
        loading.value = false;
    }
}

function goChat() {
    if (!profile.value) {
        return;
    }
    router.push({
        path: "/chat/" + profile.value.id,
        query: { name: profile.value.nickname || profile.value.username || "" }
    });
}

async function handleAddFriend() {
    if (!profile.value) {
        return;
    }
    try {
        await addFriend(profile.value.id);
        profile.value = { ...profile.value, is_friend: 1, friend_count: (profile.value.friend_count || 0) + 1 };
        ElMessage.success("好友已添加");
    } catch {}
}

async function handleRemoveFriend() {
    if (!profile.value) {
        return;
    }
    try {
        await ElMessageBox.confirm(`确认删除好友“${profile.value.nickname || profile.value.username}”？`, "删除好友");
        await removeFriend(profile.value.id);
        profile.value = { ...profile.value, is_friend: 0, friend_count: Math.max((profile.value.friend_count || 1) - 1, 0) };
        ElMessage.success("已删除好友");
    } catch {}
}

onMounted(fetchProfile);
watch(() => route.params.id, fetchProfile);
</script>

<style scoped>
.user-detail-page {
    padding-top: 8px;
}

.user-detail-container {
    max-width: 760px;
}

.user-hero {
    margin-bottom: 16px;
    padding: 24px;
    border-radius: 32px;
    background:
        radial-gradient(circle at top right, rgba(214, 227, 255, 0.66), transparent 30%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(248, 250, 255, 0.96));
    border: 1px solid rgba(194, 199, 208, 0.24);
    box-shadow: var(--shadow-lg);
}

.user-main-card {
    display: flex;
    gap: 18px;
    align-items: flex-start;
    margin-bottom: 18px;
}

.user-main-info {
    flex: 1;
    min-width: 0;
}

.user-eyebrow {
    margin-bottom: 8px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--primary);
}

.user-main-info h2 {
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.02em;
}

.user-account {
    margin-top: 6px;
    color: var(--text-tertiary);
    font-size: 13px;
}

.user-meta-row {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 10px;
    font-size: 13px;
    color: var(--primary);
    font-weight: 700;
}

.user-bio {
    margin-top: 12px;
    color: var(--text-secondary);
    line-height: 1.7;
}

.user-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
}

.user-stat-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
}

.stat-card,
.detail-card {
    padding: 16px 18px;
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.82);
    border: 1px solid rgba(194, 199, 208, 0.2);
    box-shadow: var(--shadow);
}

.stat-label,
.detail-title {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-tertiary);
}

.stat-value {
    display: block;
    margin-top: 10px;
    font-size: 28px;
    line-height: 1;
    color: var(--primary);
}

.detail-value {
    margin-top: 10px;
    color: var(--text-secondary);
    line-height: 1.7;
}

@media (max-width: 768px) {
    .user-main-card {
        flex-wrap: wrap;
    }

    .user-actions {
        width: 100%;
        justify-content: flex-start;
    }

    .user-stat-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}
</style>
