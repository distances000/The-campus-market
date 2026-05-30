<template>
<div class="chat-page"><div class="chat-container">
<div class="chat-top"><el-button text @click="$router.back()"><el-icon><ArrowLeft/></el-icon></el-button><span class="chat-title">{{chatName}}</span></div>
<div class="chat-messages" ref="msgC"><div v-for="msg in messages" :key="msg.id" class="msg-item" :class="msg.sender_id===userStore.user?.id?'self':'other'">
<el-avatar :size="32" v-if="msg.sender_id!==userStore.user?.id">{{(msg.sender_name||"")[0]}}</el-avatar>
<div class="msg-bubble"><div class="msg-text">{{msg.content}}</div><div class="msg-time">{{fmt(msg.created_at)}}</div></div>
</div><el-empty v-if="!messages.length" description="还没有消息，开始聊天吧" :image-size="64"/></div>
<div class="chat-input"><el-input v-model="inputText" placeholder="输入消息..." @keyup.enter="handleSend" size="large"><template #append><el-button type="primary" @click="handleSend" :disabled="!inputText.trim()" :loading="sending">发送</el-button></template></el-input></div>
</div></div>
</template>
<script setup>
import {ref,onMounted,nextTick,watch} from "vue";import {useRoute,useRouter} from "vue-router";import {useUserStore} from "../stores/user";import {getConversation,sendMessage,getUserBrief} from "../api/messages";
import { ArrowLeft } from "@element-plus/icons-vue";
const route=useRoute(),router=useRouter(),userStore=useUserStore(),msgC=ref(null),messages=ref([]),inputText=ref(""),sending=ref(false),chatName=ref("聊天");
function fmt(t){return t?new Date(t).toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit"}):"";}
async function fetchChatTarget(){try{const r=await getUserBrief(route.params.userId);chatName.value=r.data.nickname||r.data.username||route.query.name||"聊天";}catch{chatName.value=route.query.name||"聊天";}}
async function fetchMsgs(){try{const r=await getConversation(route.params.userId);messages.value=r.data.list;if(messages.value.length){const o=messages.value.find(m=>m.sender_id!==userStore.user?.id);chatName.value=o?.sender_name||o?.receiver_name||chatName.value;}await nextTick();if(msgC.value)msgC.value.scrollTop=msgC.value.scrollHeight;}catch{}}
async function loadChat(){await fetchChatTarget();await fetchMsgs();}
async function handleSend(){if(!inputText.value.trim())return;sending.value=true;try{await sendMessage(route.params.userId,inputText.value);inputText.value="";await fetchMsgs();}catch{}finally{sending.value=false;}}
onMounted(loadChat);
watch(()=>route.params.userId,loadChat);
</script>
<style scoped>
.chat-page{height:calc(100vh - var(--header-height) - 56px);display:flex;flex-direction:column;margin-top:12px;}
.chat-container{max-width:700px;width:100%;margin:0 auto;display:flex;flex-direction:column;height:100%;background:var(--bg-primary);}
.chat-top{display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--border);}
.chat-title{font-weight:600;font-size:16px;}
.chat-messages{flex:1;overflow-y:auto;padding:16px;}
.msg-item{display:flex;gap:8px;margin-bottom:16px;align-items:flex-start;}
.msg-item.self{flex-direction:row-reverse;}
.msg-bubble{max-width:70%;}
.msg-text{padding:10px 14px;border-radius:12px;font-size:14px;line-height:1.5;word-break:break-word;}
.msg-item.other .msg-text{background:var(--bg-tertiary);border-bottom-left-radius:4px;}
.msg-item.self .msg-text{background:var(--primary);color:#fff;border-bottom-right-radius:4px;}
.msg-time{font-size:11px;color:var(--text-tertiary);margin-top:4px;padding:0 4px;}
.chat-input{padding:12px 16px;border-top:1px solid var(--border);}
</style>
