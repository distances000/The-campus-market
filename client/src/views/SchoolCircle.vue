<template>
<div class="circle-page"><div class="page-container" style="max-width:700px">
<div class="circle-filter">
    <el-select v-model="currentCampus" placeholder="选择校区" clearable @change="handleCampusChange">
        <el-option v-for="option in campusFilters" :key="option.value" :label="option.label" :value="option.value"/>
    </el-select>
</div>
<div class="post-editor" v-if="userStore.isLoggedIn">
    <el-input v-model="newPostContent" type="textarea" :rows="3" placeholder="分享你的校园动态..." maxlength="500" show-word-limit/>
    <div class="post-editor-actions">
        <span class="post-campus">{{ publishCampusLabel }}</span>
        <el-button type="primary" :disabled="!newPostContent.trim()" :loading="posting" @click="handlePost">发布</el-button>
    </div>
</div>
<div class="post-list" v-if="posts.length>0"><div v-for="post in posts" :key="post.id" class="post-card" @click="$router.push('/post/'+post.id)">
<div class="post-author">
    <el-avatar :size="36">{{(post.author_name||"")[0]}}</el-avatar>
    <div class="post-author-info">
        <div><div class="author-name">{{post.author_name}}</div><div class="post-time">{{post.created_at}}</div></div>
        <el-tag v-if="post.campus" size="small" type="info">{{ post.campus }}</el-tag>
    </div>
</div>
<div class="post-content">{{post.content}}</div>
<div class="post-images" v-if="post.images&&post.images.length" @click.stop><img v-for="(img,i) in post.images.slice(0,9)" :key="i" :src="img" class="post-image"/></div>
<div class="post-actions" @click.stop>
    <span class="action-btn" :class="{liked:post.is_liked}" @click="handleLike(post)"><el-icon><Pointer/></el-icon>{{post.likes_count||0}}</span>
    <span class="action-btn"><el-icon><ChatLineSquare/></el-icon>{{post.comments_count||0}}</span>
    <span v-if="isAuthor(post)" class="action-btn danger" @click="handleDelete(post)"><el-icon><Delete/></el-icon>删除</span>
</div>
</div></div>
<el-empty v-else description="暂无校园墙内容"/>
<div class="load-more" v-if="hasMore"><el-button :loading="loading" @click="loadMore">加载更多</el-button></div>
</div></div>
</template>
<script setup>
import {computed, ref, onMounted} from "vue";
import {ElMessage, ElMessageBox} from "element-plus";
import {useUserStore} from "../stores/user";
import {getPosts, createPost, likePost, deletePost} from "../api/posts";
import {CAMPUS_FILTER_OPTIONS} from "../utils/options";
import { Pointer, ChatLineSquare, Delete } from "@element-plus/icons-vue";

const userStore = useUserStore();
const posts = ref([]);
const newPostContent = ref("");
const posting = ref(false);
const loading = ref(false);
const page = ref(1);
const hasMore = ref(false);
const currentCampus = ref("");
const campusFilters = CAMPUS_FILTER_OPTIONS;
const publishCampusLabel = computed(() => currentCampus.value || userStore.user?.campus || "未指定校区");

async function fetchPosts() {
    loading.value = true;
    try {
        const r = await getPosts({ page: page.value, campus: currentCampus.value || undefined });
        const d = r.data;
        if (page.value === 1) posts.value = d.list;
        else posts.value.push(...d.list);
        hasMore.value = posts.value.length < d.total;
    } catch {} finally {
        loading.value = false;
    }
}

function loadMore() {
    page.value++;
    fetchPosts();
}

function handleCampusChange() {
    page.value = 1;
    posts.value = [];
    fetchPosts();
}

async function handlePost() {
    if (!newPostContent.value.trim()) return;
    posting.value = true;
    try {
        await createPost({
            content: newPostContent.value,
            campus: currentCampus.value || userStore.user?.campus || ""
        });
        ElMessage.success("发布成功");
        newPostContent.value = "";
        page.value = 1;
        fetchPosts();
    } catch {} finally {
        posting.value = false;
    }
}

async function handleLike(post) {
    if (!userStore.isLoggedIn) {
        ElMessage.warning("请先登录");
        return;
    }
    try {
        const r = await likePost(post.id);
        post.is_liked = r.data.liked;
        post.likes_count += r.data.liked ? 1 : -1;
    } catch {}
}

function isAuthor(post) {
    return userStore.user?.id === post.author_id;
}

async function handleDelete(post) {
    try {
        await ElMessageBox.confirm(`确认删除这条校园墙内容？`, "删除确认", { type: "warning" });
        await deletePost(post.id);
        posts.value = posts.value.filter(item => item.id !== post.id);
        ElMessage.success("已删除");
    } catch {}
}

onMounted(fetchPosts);
</script>
<style scoped>
.circle-filter{display:flex;justify-content:flex-end;margin-bottom:12px;}
.post-editor{background:var(--bg-primary);border-radius:var(--radius);padding:16px;margin-bottom:12px;}
.post-editor-actions{display:flex;justify-content:space-between;align-items:center;margin-top:10px;gap:12px;}
.post-campus{font-size:12px;color:var(--text-tertiary);}
.post-list{display:flex;flex-direction:column;gap:10px;}
.post-card{background:var(--bg-primary);border-radius:var(--radius);padding:16px;cursor:pointer;transition:box-shadow 0.2s;}
.post-card:hover{box-shadow:var(--shadow-md);}
.post-author{display:flex;align-items:center;gap:10px;margin-bottom:10px;}
.post-author-info{display:flex;justify-content:space-between;align-items:center;gap:12px;flex:1;}
.author-name{font-weight:500;font-size:14px;}.post-time{font-size:12px;color:var(--text-tertiary);}
.post-content{font-size:15px;line-height:1.6;margin-bottom:10px;white-space:pre-wrap;word-break:break-word;}
.post-images{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-bottom:10px;}
.post-image{width:100%;aspect-ratio:1;object-fit:cover;border-radius:4px;background:var(--bg-tertiary);}
.post-actions{display:flex;gap:24px;flex-wrap:wrap;}
.action-btn{display:flex;align-items:center;gap:4px;font-size:13px;color:var(--text-tertiary);cursor:pointer;transition:color 0.2s;}
.action-btn:hover{color:var(--primary);}.action-btn.liked{color:var(--primary);}
.action-btn.danger:hover{color:var(--danger);}
.load-more{text-align:center;padding:20px;}
</style>
