<template>
<div class="post-detail"><div class="page-container" style="max-width:700px" v-if="post">
<div class="pd-author">
    <el-avatar :size="44">{{(post.author_name||"")[0]}}</el-avatar>
    <div class="pd-author-main">
        <div>
            <div class="author-name">{{post.author_name}}</div>
            <div class="post-time">{{post.created_at}}</div>
        </div>
        <el-button v-if="isAuthor" type="danger" plain size="small" @click="handleDelete">删除</el-button>
    </div>
</div>
<div class="pd-content">{{post.content}}</div>
<div class="pd-images" v-if="post.images&&post.images.length"><img v-for="(img,i) in post.images" :key="i" :src="img"/></div>
<div class="pd-actions"><span class="action-btn" :class="{liked:post.is_liked}" @click="handleLike"><el-icon><Pointer/></el-icon>{{post.likes_count||0}}</span><span class="action-btn"><el-icon><ChatLineSquare/></el-icon>{{post.comments_count||0}}</span></div>
<div class="comments-section" v-if="post.comments"><h3>评论（{{post.comments.length}}）</h3><div v-for="c in post.comments" :key="c.id" class="comment-item"><el-avatar :size="32">{{(c.user_name||"")[0]}}</el-avatar><div class="comment-body"><div class="comment-header"><span class="comment-name">{{c.user_name}}</span><span class="comment-time">{{c.created_at}}</span></div><div class="comment-content">{{c.content}}</div></div></div><el-empty v-if="!post.comments.length" description="暂无评论"/></div>
<div class="comment-input" v-if="userStore.isLoggedIn"><el-input v-model="commentText" placeholder="写下你的评论..." @keyup.enter="handleComment"><template #append><el-button @click="handleComment" :disabled="!commentText.trim()">发送</el-button></template></el-input></div>
</div></div>
</template>
<script setup>
import {computed, ref, onMounted} from "vue";
import {useRoute, useRouter} from "vue-router";
import {ElMessage, ElMessageBox} from "element-plus";
import {useUserStore} from "../stores/user";
import {getPost, likePost, commentPost, deletePost} from "../api/posts";
import { Pointer, ChatLineSquare } from "@element-plus/icons-vue";

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const post = ref(null);
const commentText = ref("");
const isAuthor = computed(() => userStore.user?.id === post.value?.author_id);

async function fetchPost() {
    try { post.value = (await getPost(route.params.id)).data; } catch {}
}

async function handleLike() {
    if (!userStore.isLoggedIn) { ElMessage.warning("请先登录"); return; }
    try { const r = await likePost(post.value.id); post.value.is_liked = r.data.liked; post.value.likes_count += r.data.liked ? 1 : -1; } catch {}
}

async function handleComment() {
    if (!commentText.value.trim()) return;
    try {
        const r = await commentPost(post.value.id, commentText.value);
        post.value.comments.push(r.data);
        post.value.comments_count++;
        commentText.value = "";
        ElMessage.success("评论成功");
    } catch {}
}

async function handleDelete() {
    try {
        await ElMessageBox.confirm("确认删除这条校园墙内容？删除后无法恢复。", "删除确认", { type: "warning" });
        await deletePost(post.value.id);
        ElMessage.success("已删除");
        router.push("/school-circle");
    } catch {}
}

onMounted(fetchPost);
</script>
<style scoped>
.pd-author{display:flex;align-items:center;gap:12px;padding:16px 0;}
.pd-author-main{display:flex;justify-content:space-between;align-items:center;gap:12px;flex:1;}
.author-name{font-weight:600;font-size:15px;}.post-time{font-size:12px;color:var(--text-tertiary);}
.pd-content{font-size:16px;line-height:1.8;padding:12px 0;white-space:pre-wrap;word-break:break-word;}
.pd-images{padding:12px 0;}.pd-images img{width:100%;border-radius:var(--radius);margin-bottom:8px;}
.pd-actions{display:flex;gap:24px;padding:12px 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border);}
.action-btn{display:flex;align-items:center;gap:4px;font-size:14px;color:var(--text-tertiary);cursor:pointer;}
.action-btn.liked{color:var(--primary);}
.comments-section{padding:16px 0;}.comments-section h3{font-size:15px;margin-bottom:12px;}
.comment-item{display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--bg-tertiary);}
.comment-body{flex:1;}.comment-header{display:flex;align-items:center;gap:8px;margin-bottom:4px;}
.comment-name{font-weight:500;font-size:13px;}.comment-time{font-size:11px;color:var(--text-tertiary);}
.comment-content{font-size:14px;line-height:1.5;}
.comment-input{padding:12px 0;position:sticky;bottom:64px;background:var(--bg-secondary);}
</style>
