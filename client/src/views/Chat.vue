<template>
    <div class="chat-page">
        <div class="chat-container">
            <div class="chat-top">
                <el-button text @click="$router.back()">
                    <el-icon><ArrowLeft /></el-icon>
                </el-button>
                <span class="chat-title">{{ chatName }}</span>
            </div>

            <div
                v-if="showConnectionBanner"
                class="chat-connection-banner"
                :class="`is-${connectionState}`"
            >
                {{ connectionBannerText }}
            </div>

            <div ref="msgC" class="chat-messages">
                <div
                    v-for="msg in messages"
                    :key="msg.id"
                    class="msg-item"
                    :class="msg.sender_id === userStore.user?.id ? 'self' : 'other'"
                >
                    <el-avatar v-if="msg.sender_id !== userStore.user?.id" :size="32">
                        {{ (msg.sender_name || "")[0] }}
                    </el-avatar>
                    <div class="msg-bubble">
                        <div class="msg-text">{{ msg.content }}</div>
                        <div class="msg-meta">
                            <span class="msg-time">{{ fmt(msg.created_at) }}</span>
                            <span v-if="msg.sender_id === userStore.user?.id" class="msg-status">
                                {{ msg.is_read ? "已读" : "送达" }}
                            </span>
                        </div>
                    </div>
                </div>
                <el-empty v-if="!messages.length" description="还没有消息，开始聊天吧" :image-size="64" />
            </div>

            <div class="chat-input">
                <el-input v-model="inputText" placeholder="输入消息..." @keyup.enter="handleSend" size="large">
                    <template #append>
                        <el-button
                            type="primary"
                            :disabled="!inputText.trim()"
                            :loading="sending"
                            @click="handleSend"
                        >
                            发送
                        </el-button>
                    </template>
                </el-input>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { ArrowLeft } from "../components/element-icons";
import { useUserStore } from "../stores/user";
import { subscribeMessageStream } from "../utils/message-stream";
import { getConversation, getUserBrief, markConversationRead, sendMessage } from "../api/messages";

const route = useRoute();
const userStore = useUserStore();

const msgC = ref(null);
const messages = ref([]);
const inputText = ref("");
const sending = ref(false);
const chatName = ref("聊天");
const connectionState = ref("idle");
let unsubscribeStream = null;

function currentPeerId() {
    return Number(route.params.userId);
}

function fmt(time) {
    return time
        ? new Date(time).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
        : "";
}

const showConnectionBanner = computed(() =>
    ["connecting", "reconnecting", "error"].includes(connectionState.value)
);
const connectionBannerText = computed(() => {
    if (connectionState.value === "reconnecting") {
        return "连接已断开，正在重连…";
    }
    if (connectionState.value === "error") {
        return "实时连接异常，正在尝试恢复…";
    }
    return "正在连接聊天服务…";
});

function hasMessage(messageId) {
    return messages.value.some((item) => item.id === messageId);
}

async function scrollToBottom() {
    await nextTick();
    if (msgC.value) {
        msgC.value.scrollTop = msgC.value.scrollHeight;
    }
}

function applyReadReceipt(payload) {
    const peerId = currentPeerId();
    if (!payload) {
        return;
    }
    if (Number(payload.reader_id) !== peerId || Number(payload.peer_id) !== userStore.user?.id) {
        return;
    }

    messages.value = messages.value.map((item) => {
        if (item.sender_id === userStore.user?.id && item.id <= payload.last_read_message_id) {
            return { ...item, is_read: 1 };
        }
        return item;
    });
}

async function appendMessage(message, forceScroll = false) {
    if (!message || hasMessage(message.id)) {
        return;
    }

    messages.value.push(message);

    if (message.sender_id !== userStore.user?.id) {
        await markConversationRead(currentPeerId());
    }
    if (forceScroll || !messages.value.length) {
        await scrollToBottom();
    }
}

async function fetchChatTarget() {
    try {
        const response = await getUserBrief(route.params.userId);
        chatName.value = response.data.nickname || response.data.username || route.query.name || "聊天";
    } catch {
        chatName.value = route.query.name || "聊天";
    }
}

async function fetchMessages(forceScroll = false) {
    try {
        const response = await getConversation(route.params.userId);
        messages.value = response.data.list;
        if (messages.value.length) {
            const otherMessage = messages.value.find((item) => item.sender_id !== userStore.user?.id);
            chatName.value = otherMessage?.sender_name || otherMessage?.receiver_name || chatName.value;
        }
        if (forceScroll || messages.value.length) {
            await scrollToBottom();
        }
    } catch {}
}

async function loadChat(forceScroll = false) {
    await fetchChatTarget();
    await fetchMessages(forceScroll);
}

function bindStream() {
    if (unsubscribeStream) {
        unsubscribeStream();
        unsubscribeStream = null;
    }
    if (!userStore.token) {
        return;
    }

    unsubscribeStream = subscribeMessageStream(userStore.token, {
        onMessageCreated: async (message) => {
            const peerId = currentPeerId();
            if (!message) {
                return;
            }
            const isCurrentConversation =
                (message.sender_id === peerId && message.receiver_id === userStore.user?.id) ||
                (message.sender_id === userStore.user?.id && message.receiver_id === peerId);
            if (!isCurrentConversation) {
                return;
            }
            await appendMessage(message, true);
        },
        onMessageRead: (payload) => {
            applyReadReceipt(payload);
        },
        onConnectionStateChange: (state) => {
            connectionState.value = state || "idle";
        }
    });
}

async function handleSend() {
    if (!inputText.value.trim()) {
        return;
    }

    sending.value = true;
    try {
        const response = await sendMessage(route.params.userId, inputText.value);
        inputText.value = "";
        await appendMessage(response.data, true);
    } catch {} finally {
        sending.value = false;
    }
}

function handleVisibilityChange() {
    if (document.visibilityState === "visible") {
        fetchMessages(true);
    }
}

onMounted(async () => {
    await loadChat(true);
    bindStream();
    document.addEventListener("visibilitychange", handleVisibilityChange);
});

onUnmounted(() => {
    if (unsubscribeStream) {
        unsubscribeStream();
        unsubscribeStream = null;
    }
    document.removeEventListener("visibilitychange", handleVisibilityChange);
});

watch(() => route.params.userId, async () => {
    await loadChat(true);
});

watch(() => userStore.token, () => {
    bindStream();
});
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
    width: 100%;
    gap: 10px;
    margin-bottom: 18px;
    align-items: flex-start;
}

.msg-item.self {
    justify-content: flex-end;
}

.msg-item.other {
    justify-content: flex-start;
}

.msg-bubble {
    display: flex;
    flex-direction: column;
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

.msg-meta {
    display: flex;
    gap: 8px;
    margin-top: 6px;
    padding: 0 6px;
}

.msg-item.self .msg-meta {
    justify-content: flex-end;
}

.msg-item.other .msg-meta {
    justify-content: flex-start;
}

.msg-time,
.msg-status {
    font-size: 11px;
    color: var(--text-tertiary);
}

.chat-connection-banner {
    padding: 10px 18px;
    font-size: 13px;
    font-weight: 600;
    border-bottom: 1px solid rgba(223, 226, 235, 0.82);
}

.chat-connection-banner.is-connecting {
    color: #6b4f00;
    background: rgba(255, 244, 204, 0.9);
}

.chat-connection-banner.is-reconnecting,
.chat-connection-banner.is-error {
    color: #8d2c0b;
    background: rgba(255, 225, 214, 0.92);
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
