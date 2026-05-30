<template>
<div class="circle-page"><div class="page-container" style="max-width:700px">
<div class="post-editor" v-if="userStore.isLoggedIn"><el-input v-model="newPostContent" type="textarea" :rows="3" placeholder="????????..." maxlength="500" show-word-limit/><div class="post-editor-actions"><el-button type="primary" :disabled="!newPostContent.trim()" :loading="posting" @click="handlePost">????</el-button></div></div>
<div class="post-list" v-if="posts.length>0"><div v-for="post in posts" :key="post.id" class="post-card" @click="$router.push('/post/'+post.id)">
<div class="post-author"><el-avatar :size="36">{{(post.author_name||"")[0]}}</el-avatar><div><div class="author-name">{{post.author_name}}</div><div class="post-time">{{post.created_at}}</div></div></div>
<div class="post-content">{{post.content}}</div>
<div class="post-images" v-if="post.images&&post.images.length" @click.stop><img v-for="(img,i) in post.images.slice(0,9)" :key="i" :src="img" class="post-image"/></div>
<div class="post-actions" @click.stop><span class="action-btn" :class="{liked:post.is_liked}" @click="handleLike(post)"><el-icon><Pointer/></el-icon>{{post.likes_count||0}}</span><span class="action-btn"><el-icon><ChatLineSquare/></el-icon>{{post.comments_count||0}}</span></div>
</div></div>
<el-empty v-else description="????"/>
<div class="load-more" v-if="hasMore"><el-button :loading="loading" @click="loadMore">????</el-button></div>
</div></div>
</template>
<script setup>
import {ref,onMounted} from "vue";import {ElMessage} from "element-plus";import {useUserStore} from "../stores/user";import {getPosts,createPost,likePost} from "../api/posts";
import { Pointer, ChatLineSquare } from "@element-plus/icons-vue";
const userStore=useUserStore(),posts=ref([]),newPostContent=ref(""),posting=ref(false),loading=ref(false),page=ref(1),hasMore=ref(false);
async function fetchPosts(){loading.value=true;try{const r=await getPosts({page:page.value});const d=r.data;if(page.value===1)posts.value=d.list;else posts.value.push(...d.list);hasMore.value=posts.value.length<d.total;}catch{}finally{loading.value=false;}}
function loadMore(){page.value++;fetchPosts();}
async function handlePost(){if(!newPostContent.value.trim())return;posting.value=true;try{await createPost({content:newPostContent.value});ElMessage.success("????");newPostContent.value="";page.value=1;fetchPosts();}catch{}finally{posting.value=false;}}
async function handleLike(post){if(!userStore.isLoggedIn){ElMessage.warning("????");return;}try{const r=await likePost(post.id);post.is_liked=r.data.liked;post.likes_count+=r.data.liked?1:-1;}catch{}}
onMounted(fetchPosts);
</script>
<style scoped>
.post-editor{background:var(--bg-primary);border-radius:var(--radius);padding:16px;margin-bottom:12px;}
.post-editor-actions{display:flex;justify-content:flex-end;margin-top:10px;}
.post-list{display:flex;flex-direction:column;gap:10px;}
.post-card{background:var(--bg-primary);border-radius:var(--radius);padding:16px;cursor:pointer;transition:box-shadow 0.2s;}
.post-card:hover{box-shadow:var(--shadow-md);}
.post-author{display:flex;align-items:center;gap:10px;margin-bottom:10px;}
.author-name{font-weight:500;font-size:14px;}.post-time{font-size:12px;color:var(--text-tertiary);}
.post-content{font-size:15px;line-height:1.6;margin-bottom:10px;white-space:pre-wrap;word-break:break-word;}
.post-images{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-bottom:10px;}
.post-image{width:100%;aspect-ratio:1;object-fit:cover;border-radius:4px;background:var(--bg-tertiary);}
.post-actions{display:flex;gap:24px;}
.action-btn{display:flex;align-items:center;gap:4px;font-size:13px;color:var(--text-tertiary);cursor:pointer;transition:color 0.2s;}
.action-btn:hover{color:var(--primary);}.action-btn.liked{color:var(--primary);}
.load-more{text-align:center;padding:20px;}
</style>
