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
import {ref,onMounted,onUnmounted,nextTick,watch} from "vue";import {useRoute,useRouter} from "vue-router";import {useUserStore} from "../stores/user";import {getConversation,sendMessage,getUserBrief} from "../api/messages";
import { ArrowLeft } from "@element-plus/icons-vue";
const route=useRoute(),router=useRouter(),userStore=useUserStore(),msgC=ref(null),messages=ref([]),inputText=ref(""),sending=ref(false),chatName=ref("聊天");
let chatTimer=null;
function fmt(t){return t?new Date(t).toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit"}):"";}
async function fetchChatTarget(){try{const r=await getUserBrief(route.params.userId);chatName.value=r.data.nickname||r.data.username||route.query.name||"聊天";}catch{chatName.value=route.query.name||"聊天";}}
function shouldStickToBottom(){if(!msgC.value)return true;return msgC.value.scrollHeight-msgC.value.scrollTop-msgC.value.clientHeight<60;}
async function fetchMsgs(forceScroll=false){try{const stickBottom=forceScroll||shouldStickToBottom()||!messages.value.length;const r=await getConversation(route.params.userId);messages.value=r.data.list;if(messages.value.length){const o=messages.value.find(m=>m.sender_id!==userStore.user?.id);chatName.value=o?.sender_name||o?.receiver_name||chatName.value;}await nextTick();if(msgC.value&&stickBottom)msgC.value.scrollTop=msgC.value.scrollHeight;}catch{}}
async function loadChat(){await fetchChatTarget();await fetchMsgs();}
async function handleSend(){if(!inputText.value.trim())return;sending.value=true;try{await sendMessage(route.params.userId,inputText.value);inputText.value="";await fetchMsgs(true);}catch{}finally{sending.value=false;}}
async function syncChat(){if(document.visibilityState==="hidden")return;await fetchMsgs();}
function startChatPolling(){stopChatPolling();syncChat();chatTimer=window.setInterval(syncChat,3000);}
function stopChatPolling(){if(!chatTimer)return;window.clearInterval(chatTimer);chatTimer=null;}
function handleVisibilityChange(){if(document.visibilityState==="visible")syncChat();}
onMounted(loadChat);
onMounted(()=>{startChatPolling();document.addEventListener("visibilitychange",handleVisibilityChange);});
onUnmounted(()=>{stopChatPolling();document.removeEventListener("visibilitychange",handleVisibilityChange);});
watch(()=>route.params.userId,loadChat);
</script>
<style scoped>
.chat-page {
    height: calc(100vh - var(--header-height) - 92px);
    display: flex;
    flex-direction: column;
    margin-top: 12px;
}

.chat-container {
    max-width: 760px;
    width: 100%;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    height: 100%;
    background: rgba(255, 255, 255, 0.86);
    border-radius: 32px;
    border: 1px solid rgba(194, 199, 208, 0.22);
    box-shadow: var(--shadow-lg);
    overflow: hidden;
    backdrop-filter: blur(10px);
}

.chat-top {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 18px;
    border-bottom: 1px solid rgba(223, 226, 235, 0.82);
    background: rgba(248, 250, 255, 0.92);
}

.chat-title {
    font-weight: 700;
    font-size: 17px;
}

.chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 18px;
    background:
        radial-gradient(circle at top right, rgba(214, 227, 255, 0.28), transparent 22%),
        linear-gradient(180deg, rgba(252, 248, 255, 0.72), rgba(244, 243, 249, 0.56));
}

.msg-item {
    display: flex;
    gap: 10px;
    margin-bottom: 18px;
    align-items: flex-start;
}

.msg-item.self {
    flex-direction: row-reverse;
}

.msg-bubble {
    max-width: 72%;
}

.msg-text {
    padding: 12px 16px;
    border-radius: 22px;
    font-size: 14px;
    line-height: 1.65;
    word-break: break-word;
    box-shadow: var(--shadow);
}

.msg-item.other .msg-text {
    background: rgba(240, 242, 248, 0.94);
    color: var(--text-primary);
    border-bottom-left-radius: 8px;
}

.msg-item.self .msg-text {
    background: var(--primary);
    color: #fff;
    border-bottom-right-radius: 8px;
}

.msg-time {
    font-size: 11px;
    color: var(--text-tertiary);
    margin-top: 6px;
    padding: 0 6px;
}

.chat-input {
    padding: 14px 16px 16px;
    border-top: 1px solid rgba(223, 226, 235, 0.82);
    background: rgba(248, 250, 255, 0.92);
}

@media (max-width: 640px) {
    .chat-page {
        height: calc(100vh - var(--header-height) - 88px);
    }

    .chat-container {
        border-radius: 24px;
    }

    .msg-bubble {
        max-width: 82%;
    }
}
</style>
