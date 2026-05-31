<template>
<div class="messages-page" v-if="userStore.isLoggedIn"><div class="page-container" style="max-width:760px">
<div class="hero-panel">
    <div class="page-header">
        <div>
            <h2 class="page-title">消息中心</h2>
            <p class="page-subtitle">把私聊、互动提醒和业务通知收在一个入口里，减少来回切页。</p>
        </div>
        <div class="hero-badge">
            <span class="hero-badge-label">总未读</span>
            <strong class="hero-badge-value">{{ unreadSummary.unread_count }}</strong>
        </div>
    </div>
</div>

<div class="search-card">
    <el-input
        v-model="searchKeyword"
        placeholder="搜索好友或陌生人"
        clearable
        @keyup.enter="handleSearch"
        @clear="clearSearch"
    >
        <template #append><el-button @click="handleSearch" :loading="searching">搜索</el-button></template>
    </el-input>
</div>

<div class="search-results" v-if="searchPerformed">
    <div class="section-title">搜索结果</div>
    <div class="list-card" v-if="searchResults.length">
        <div v-for="user in searchResults" :key="user.id" class="list-item">
            <div class="user-meta">
                <el-avatar :size="44">{{ (user.nickname || user.username || "")[0] }}</el-avatar>
                <div class="user-info">
                    <div class="user-name">{{ user.nickname || user.username }}</div>
                    <div class="user-sub">{{ user.username }}<span v-if="user.campus"> · {{ user.campus }}</span></div>
                </div>
            </div>
            <div class="user-actions">
                <el-button size="small" plain @click="startChat(user)">发消息</el-button>
                <el-button v-if="!user.is_friend" size="small" type="primary" @click="handleAddFriend(user)">添加好友</el-button>
                <el-tag v-else type="success" size="small">已是好友</el-tag>
            </div>
        </div>
    </div>
    <el-empty v-else description="没有找到匹配用户" :image-size="64"/>
</div>

<div class="tabs-shell">
<div class="tabs">
    <button type="button" class="tab-btn" :class="{ active: activeTab === 'conversations' }" @click="activeTab='conversations'">
        <span>最近会话</span>
        <span v-if="unreadSummary.chat_unread_count>0" class="tab-count">{{ unreadSummary.chat_unread_count > 99 ? "99+" : unreadSummary.chat_unread_count }}</span>
    </button>
    <button type="button" class="tab-btn" :class="{ active: activeTab === 'friends' }" @click="activeTab='friends'">
        <span>好友列表</span>
        <span v-if="friends.length>0" class="tab-count muted">{{ friends.length }}</span>
    </button>
    <button type="button" class="tab-btn" :class="{ active: activeTab === 'interaction' }" @click="activeTab='interaction'">
        <span>互动通知</span>
        <span v-if="unreadSummary.interaction_unread_count>0" class="tab-count warn">{{ unreadSummary.interaction_unread_count > 99 ? "99+" : unreadSummary.interaction_unread_count }}</span>
    </button>
    <button type="button" class="tab-btn" :class="{ active: activeTab === 'system' }" @click="activeTab='system'">
        <span>系统通知</span>
        <span v-if="unreadSummary.system_unread_count>0" class="tab-count muted">{{ unreadSummary.system_unread_count > 99 ? "99+" : unreadSummary.system_unread_count }}</span>
    </button>
</div>
</div>

<div v-if="activeTab==='conversations'">
    <div class="list-card" v-if="convs.length>0">
        <div v-for="c in convs" :key="c.other_id" class="list-item list-item-clickable" @click="startChat({ id: c.other_id, nickname: c.other_name })">
            <div class="user-meta">
                <el-avatar :size="48">{{(c.other_name||'')[0]}}</el-avatar>
                <div class="user-info">
                    <div class="user-name">{{ c.other_name }}<span class="item-time">{{ fmt(c.last_time) }}</span></div>
                    <div class="user-sub">{{ c.last_message || "暂无消息" }}</div>
                </div>
            </div>
            <span class="conv-badge" v-if="c.unread_count>0">{{ c.unread_count>99 ? "99+" : c.unread_count }}</span>
        </div>
    </div>
    <el-empty v-else description="还没有聊天记录" :image-size="80"/>
</div>

<div v-else-if="activeTab==='friends'">
    <div class="list-card" v-if="friends.length>0">
        <div v-for="friend in friends" :key="friend.id" class="list-item">
            <div class="user-meta">
                <el-avatar :size="48">{{(friend.nickname||friend.username||'')[0]}}</el-avatar>
                <div class="user-info">
                    <div class="user-name">{{ friend.nickname || friend.username }}<span class="item-time">{{ fmt(friend.last_time) }}</span></div>
                    <div class="user-sub">{{ friend.campus || "未设置校区" }}<span v-if="friend.last_message"> · {{ friend.last_message }}</span></div>
                </div>
            </div>
            <div class="user-actions">
                <span class="conv-badge" v-if="friend.unread_count>0">{{ friend.unread_count>99 ? "99+" : friend.unread_count }}</span>
                <el-button size="small" type="primary" @click="startChat(friend)">聊天</el-button>
            </div>
        </div>
    </div>
    <el-empty v-else description="还没有好友" :image-size="80"/>
</div>

<div v-else>
    <div class="section-head">
        <div>
            <div class="section-title">{{ activeTab === 'interaction' ? "互动通知" : "系统通知" }}</div>
            <div class="section-subtitle">{{ activeTab === 'interaction' ? "来自校园墙、收藏和好友关系的提醒" : "来自订单与评价流程的自动提醒" }}</div>
        </div>
        <el-button plain size="small" @click="handleReadAll(activeTab)" :disabled="currentUnreadCount===0">全部已读</el-button>
    </div>
    <div class="list-card" v-if="currentNotifications.length>0">
        <div v-for="item in currentNotifications" :key="item.id" class="list-item list-item-clickable notification-item" :class="{ unread: !item.is_read }" @click="handleNotificationClick(item)">
            <div class="user-meta">
                <el-avatar :size="44">{{ (item.actor_name || item.title || "")[0] }}</el-avatar>
                <div class="user-info">
                    <div class="user-name">
                        <span>{{ item.title }}</span>
                        <span class="item-time">{{ fmt(item.created_at) }}</span>
                    </div>
                    <div class="user-sub multiline">{{ buildNotificationText(item) }}</div>
                </div>
            </div>
            <div class="notification-side">
                <span class="conv-badge" v-if="!item.is_read">新</span>
                <el-tag size="small" :type="activeTab === 'interaction' ? 'warning' : 'info'">{{ activeTab === 'interaction' ? "互动" : "系统" }}</el-tag>
            </div>
        </div>
    </div>
    <el-empty v-else :description="activeTab === 'interaction' ? '暂时没有互动通知' : '暂时没有系统通知'" :image-size="80"/>
</div>
</div></div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { useUserStore } from "../stores/user";
import { addFriend, getConversations, getFriends, getNotifications, getUnreadCount, readNotifications, searchUsers } from "../api/messages";

const router = useRouter();
const userStore = useUserStore();
const activeTab = ref("conversations");
const convs = ref([]);
const friends = ref([]);
const searchKeyword = ref("");
const searchResults = ref([]);
const searchPerformed = ref(false);
const searching = ref(false);
const interactionNotifications = ref([]);
const systemNotifications = ref([]);
const unreadSummary = ref({
    unread_count: 0,
    chat_unread_count: 0,
    interaction_unread_count: 0,
    system_unread_count: 0
});
let syncTimer = null;

const currentNotifications = computed(() => activeTab.value === "interaction" ? interactionNotifications.value : systemNotifications.value);
const currentUnreadCount = computed(() => activeTab.value === "interaction" ? unreadSummary.value.interaction_unread_count : unreadSummary.value.system_unread_count);

function fmt(t) {
    if (!t) return "";
    const d = new Date(t);
    const n = new Date();
    const diff = n - d;
    if (diff < 6e4) return "刚刚";
    if (diff < 36e5) return Math.floor(diff / 6e4) + " 分钟前";
    if (diff < 864e5) return Math.floor(diff / 36e5) + " 小时前";
    return d.toLocaleDateString("zh-CN");
}

function buildNotificationText(item) {
    const actor = item.actor_name ? `${item.actor_name} · ` : "";
    return actor + (item.content || "点击查看详情");
}

async function fetchConvs() {
    try {
        convs.value = (await getConversations()).data;
    } catch {}
}

async function fetchFriends() {
    try {
        friends.value = (await getFriends()).data;
    } catch {}
}

async function fetchUnreadSummary() {
    try {
        unreadSummary.value = (await getUnreadCount()).data;
    } catch {}
}

async function fetchNotificationList(kind) {
    try {
        const response = await getNotifications(kind);
        if (kind === "interaction") interactionNotifications.value = response.data.list;
        else systemNotifications.value = response.data.list;
    } catch {}
}

async function handleSearch() {
    const keyword = searchKeyword.value.trim();
    searchPerformed.value = true;
    if (!keyword) {
        searchResults.value = [];
        return;
    }
    searching.value = true;
    try {
        searchResults.value = (await searchUsers(keyword)).data;
    } catch {} finally {
        searching.value = false;
    }
}

function clearSearch() {
    searchKeyword.value = "";
    searchResults.value = [];
    searchPerformed.value = false;
}

async function handleAddFriend(user) {
    try {
        await addFriend(user.id);
        user.is_friend = 1;
        ElMessage.success("好友已添加");
        await fetchFriends();
    } catch {}
}

function startChat(user) {
    router.push({ path: "/chat/" + user.id, query: { name: user.nickname || user.username || "" } });
}

async function handleReadAll(kind) {
    try {
        await readNotifications({ kind });
        if (kind === "interaction") {
            interactionNotifications.value = interactionNotifications.value.map(item => ({ ...item, is_read: 1 }));
        } else {
            systemNotifications.value = systemNotifications.value.map(item => ({ ...item, is_read: 1 }));
        }
        await fetchUnreadSummary();
        ElMessage.success("已标记为已读");
    } catch {}
}

async function handleNotificationClick(item) {
    if (!item.is_read) {
        try {
            await readNotifications({ id: item.id });
            item.is_read = 1;
            await fetchUnreadSummary();
        } catch {}
    }
    if (item.object_type === "post" && item.object_id) {
        router.push("/post/" + item.object_id);
        return;
    }
    if (item.object_type === "product" && item.object_id) {
        router.push("/product/" + item.object_id);
        return;
    }
    if (item.object_type === "friend" && item.object_id) {
        router.push({ path: "/chat/" + item.object_id, query: { name: item.actor_name || "" } });
        return;
    }
    if (item.object_type === "review") {
        router.push({ path: "/profile", query: { tab: "reviews" } });
        return;
    }
    if (item.object_type === "order") {
        router.push({ path: "/profile", query: { tab: "orders" } });
    }
}

async function syncMessagePage() {
    if (!userStore.isLoggedIn) return;
    if (document.visibilityState === "hidden") return;
    const tasks = [fetchConvs(), fetchFriends(), fetchUnreadSummary()];
    if (activeTab.value === "interaction") tasks.push(fetchNotificationList("interaction"));
    if (activeTab.value === "system") tasks.push(fetchNotificationList("system"));
    await Promise.all(tasks);
}

function startSyncPolling() {
    stopSyncPolling();
    syncMessagePage();
    syncTimer = window.setInterval(syncMessagePage, 8000);
}

function stopSyncPolling() {
    if (!syncTimer) return;
    window.clearInterval(syncTimer);
    syncTimer = null;
}

function handleVisibilityChange() {
    if (document.visibilityState === "visible") syncMessagePage();
}

watch(activeTab, async (tab) => {
    if (tab === "interaction") await fetchNotificationList("interaction");
    if (tab === "system") await fetchNotificationList("system");
});

onMounted(() => {
    startSyncPolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);
});
onUnmounted(() => {
    stopSyncPolling();
    document.removeEventListener("visibilitychange", handleVisibilityChange);
});
watch(() => userStore.isLoggedIn, (loggedIn) => {
    if (loggedIn) startSyncPolling();
    else stopSyncPolling();
});
</script>

<style scoped>
.messages-page {
    padding-top: 8px;
}

.hero-panel {
    margin-bottom: 18px;
    padding: 22px;
    border-radius: 32px;
    background:
        radial-gradient(circle at top right, rgba(214, 227, 255, 0.68), transparent 28%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(248, 250, 255, 0.94));
    border: 1px solid rgba(194, 199, 208, 0.22);
    box-shadow: var(--shadow-lg);
}

.page-header {
    margin-bottom: 18px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
}

.page-title {
    font-size: 28px;
    font-weight: 700;
    margin-bottom: 8px;
    letter-spacing: -0.01em;
}

.page-subtitle {
    font-size: 13px;
    color: var(--text-tertiary);
    line-height: 1.7;
    max-width: 440px;
}

.hero-badge {
    flex-shrink: 0;
    min-width: 118px;
    padding: 14px 16px;
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.82);
    border: 1px solid rgba(194, 199, 208, 0.2);
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: flex-start;
}

.hero-badge-label {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-tertiary);
}

.hero-badge-value {
    font-size: 30px;
    line-height: 1;
    color: var(--primary);
}

.search-card {
    background: rgba(255, 255, 255, 0.88);
    border-radius: 28px;
    padding: 16px;
    margin-bottom: 18px;
    border: 1px solid rgba(194, 199, 208, 0.22);
    box-shadow: var(--shadow);
}

.search-results {
    margin-bottom: 18px;
}

.tabs-shell {
    margin-bottom: 14px;
    padding: 6px;
    border-radius: 999px;
    background: rgba(232, 238, 249, 0.7);
    display: inline-flex;
    max-width: 100%;
}

.section-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
}

.section-title {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-secondary);
    margin-bottom: 4px;
}

.section-subtitle {
    font-size: 12px;
    color: var(--text-tertiary);
    line-height: 1.6;
}

.tabs {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
}

.tab-btn {
    appearance: none;
    -webkit-appearance: none;
    border: none;
    background: transparent;
    padding: 11px 16px;
    border-radius: 999px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s ease;
    font-weight: 700;
    min-height: 42px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
}

.tab-btn.active {
    background: rgba(255, 255, 255, 0.96);
    color: var(--primary);
    box-shadow: var(--shadow);
}

.tab-btn:hover {
    color: var(--primary-dark);
}

.tab-count {
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: rgba(65, 95, 145, 0.12);
    color: var(--primary);
    font-size: 11px;
    font-weight: 800;
    line-height: 1;
}

.tab-count.warn {
    background: rgba(143, 78, 0, 0.12);
    color: #8f4e00;
}

.tab-count.muted {
    background: rgba(68, 71, 79, 0.12);
    color: var(--text-secondary);
}

.list-card {
    background: rgba(255, 255, 255, 0.88);
    border-radius: 28px;
    overflow: hidden;
    border: 1px solid rgba(194, 199, 208, 0.22);
    box-shadow: var(--shadow);
}

.list-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 16px 18px;
    border-bottom: 1px solid rgba(223, 226, 235, 0.72);
}

.list-item:last-child {
    border-bottom: none;
}

.list-item-clickable {
    cursor: pointer;
    transition: background-color 0.2s ease;
}

.list-item-clickable:hover {
    background: rgba(240, 242, 248, 0.48);
}

.notification-item.unread {
    background: rgba(214, 227, 255, 0.18);
}

.user-meta {
    display: flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
    flex: 1;
}

.user-info {
    min-width: 0;
    flex: 1;
}

.user-name {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 15px;
    font-weight: 700;
    align-items: center;
}

.item-time {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-tertiary);
}

.user-sub {
    font-size: 13px;
    color: var(--text-tertiary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 4px;
}

.user-sub.multiline {
    white-space: normal;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
}

.user-actions,
.notification-side {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
}

.conv-badge {
    flex-shrink: 0;
    background: var(--badge-bg);
    color: #fff;
    font-size: 11px;
    min-width: 18px;
    height: 18px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 5px;
}

@media (max-width: 640px) {
    .hero-panel {
        padding: 18px;
        border-radius: 26px;
    }

    .page-header {
        flex-direction: column;
    }

    .hero-badge {
        width: 100%;
        flex-direction: row;
        align-items: baseline;
        justify-content: space-between;
    }

    .tabs-shell {
        display: flex;
        border-radius: 24px;
    }
}
</style>
