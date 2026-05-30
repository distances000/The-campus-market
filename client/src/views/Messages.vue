<template>
<div class="messages-page" v-if="userStore.isLoggedIn"><div class="page-container" style="max-width:760px">
<div class="page-header">
    <h2 class="page-title">消息</h2>
    <p class="page-subtitle">搜索好友和陌生人、添加好友、继续聊天</p>
</div>

<div class="search-card">
    <el-input
        v-model="searchKeyword"
        placeholder="搜索用户名或昵称"
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

<div class="tabs">
    <button class="tab-btn" :class="{ active: activeTab === 'conversations' }" @click="activeTab='conversations'">最近会话</button>
    <button class="tab-btn" :class="{ active: activeTab === 'friends' }" @click="activeTab='friends'">好友列表</button>
</div>

<div v-if="activeTab==='conversations'">
    <div class="list-card" v-if="convs.length>0">
        <div v-for="c in convs" :key="c.other_id" class="list-item list-item-clickable" @click="startChat({ id: c.other_id, nickname: c.other_name })">
            <div class="user-meta">
                <el-avatar :size="48">{{(c.other_name||"")[0]}}</el-avatar>
                <div class="user-info">
                    <div class="user-name">{{c.other_name}}<span class="item-time">{{fmt(c.last_time)}}</span></div>
                    <div class="user-sub">{{c.last_message || "暂无消息"}}</div>
                </div>
            </div>
            <span class="conv-badge" v-if="c.unread_count>0">{{c.unread_count>99?"99+":c.unread_count}}</span>
        </div>
    </div>
    <el-empty v-else description="还没有聊天记录" :image-size="80"/>
</div>

<div v-else>
    <div class="list-card" v-if="friends.length>0">
        <div v-for="friend in friends" :key="friend.id" class="list-item">
            <div class="user-meta">
                <el-avatar :size="48">{{(friend.nickname||friend.username||"")[0]}}</el-avatar>
                <div class="user-info">
                    <div class="user-name">{{friend.nickname || friend.username}}<span class="item-time">{{fmt(friend.last_time)}}</span></div>
                    <div class="user-sub">{{friend.campus || "未设置校区"}}<span v-if="friend.last_message"> · {{ friend.last_message }}</span></div>
                </div>
            </div>
            <div class="user-actions">
                <span class="conv-badge" v-if="friend.unread_count>0">{{friend.unread_count>99?"99+":friend.unread_count}}</span>
                <el-button size="small" type="primary" @click="startChat(friend)">聊天</el-button>
            </div>
        </div>
    </div>
    <el-empty v-else description="还没有好友" :image-size="80"/>
</div>
</div></div>
</template>
<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { useUserStore } from "../stores/user";
import { addFriend, getConversations, getFriends, searchUsers } from "../api/messages";

const router = useRouter();
const userStore = useUserStore();
const activeTab = ref("conversations");
const convs = ref([]);
const friends = ref([]);
const searchKeyword = ref("");
const searchResults = ref([]);
const searchPerformed = ref(false);
const searching = ref(false);

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

onMounted(() => {
    fetchConvs();
    fetchFriends();
});
</script>
<style scoped>
.page-header{margin-bottom:16px;}
.page-title{font-size:20px;font-weight:600;margin-bottom:4px;}
.page-subtitle{font-size:13px;color:var(--text-tertiary);}
.search-card{background:var(--bg-primary);border-radius:var(--radius);padding:14px 16px;margin-bottom:16px;}
.search-results{margin-bottom:16px;}
.section-title{font-size:14px;font-weight:600;color:var(--text-secondary);margin-bottom:10px;}
.tabs{display:flex;gap:8px;margin-bottom:12px;}
.tab-btn{border:none;background:var(--bg-primary);padding:10px 16px;border-radius:999px;color:var(--text-secondary);cursor:pointer;transition:all .2s;}
.tab-btn.active{background:var(--primary);color:#fff;}
.list-card{background:var(--bg-primary);border-radius:var(--radius);overflow:hidden;}
.list-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid var(--bg-tertiary);}
.list-item:last-child{border-bottom:none;}
.list-item-clickable{cursor:pointer;}
.user-meta{display:flex;align-items:center;gap:12px;min-width:0;flex:1;}
.user-info{min-width:0;flex:1;}
.user-name{display:flex;justify-content:space-between;gap:8px;font-size:15px;font-weight:500;align-items:center;}
.item-time{font-size:12px;font-weight:400;color:var(--text-tertiary);}
.user-sub{font-size:13px;color:var(--text-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:4px;}
.user-actions{display:flex;align-items:center;gap:8px;flex-shrink:0;}
.conv-badge{flex-shrink:0;background:var(--danger);color:#fff;font-size:11px;min-width:18px;height:18px;border-radius:9px;display:flex;align-items:center;justify-content:center;padding:0 5px;}
</style>
