<template>
<div class="messages-page" v-if="userStore.isLoggedIn"><div class="page-container" style="max-width:700px">
<h2 class="page-title">??</h2>
<div class="conv-list" v-if="convs.length>0"><div v-for="c in convs" :key="c.other_id" class="conv-item" @click="$router.push('/chat/'+c.other_id)">
<el-avatar :size="48">{{(c.other_name||"")[0]}}</el-avatar><div class="conv-body"><div class="conv-name">{{c.other_name}}<span class="conv-time">{{fmt(c.last_time)}}</span></div><div class="conv-preview">{{c.last_message}}</div></div><span class="conv-badge" v-if="c.unread_count>0">{{c.unread_count>99?"99+":c.unread_count}}</span>
</div></div>
<el-empty v-else description="????" :image-size="80"/>
</div></div>
</template>
<script setup>
import {ref,onMounted} from "vue";import {useUserStore} from "../stores/user";import {getConversations} from "../api/messages";
const userStore=useUserStore(),convs=ref([]);
function fmt(t){if(!t)return"";const d=new Date(t),n=new Date(),diff=n-d;if(diff<6e4)return"??";if(diff<36e5)return Math.floor(diff/6e4)+"???";if(diff<864e5)return Math.floor(diff/36e5)+"???";return d.toLocaleDateString("zh-CN");}
async function fetchConvs(){try{convs.value=(await getConversations()).data;}catch{}}
onMounted(fetchConvs);
</script>
<style scoped>
.page-title{font-size:20px;font-weight:600;margin-bottom:16px;}
.conv-list{background:var(--bg-primary);border-radius:var(--radius);}
.conv-item{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--bg-tertiary);cursor:pointer;position:relative;}
.conv-item:last-child{border-bottom:none;}
.conv-body{flex:1;min-width:0;}
.conv-name{display:flex;justify-content:space-between;font-weight:500;font-size:15px;margin-bottom:4px;}
.conv-time{font-weight:400;font-size:12px;color:var(--text-tertiary);}
.conv-preview{font-size:13px;color:var(--text-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.conv-badge{flex-shrink:0;background:var(--danger);color:#fff;font-size:11px;min-width:18px;height:18px;border-radius:9px;display:flex;align-items:center;justify-content:center;padding:0 5px;}
</style>
