<template>
    <div class="post-detail">
        <div v-if="post" class="page-container post-detail-container">
            <div class="pd-author">
                <el-avatar :size="44">{{ (post.author_name || "")[0] }}</el-avatar>
                <div class="pd-author-main">
                    <div>
                        <div class="author-name">{{ post.author_name }}</div>
                        <div class="post-time">{{ post.created_at }}</div>
                    </div>
                    <div class="pd-author-actions">
                        <el-button v-if="canReport" text @click="openReportDialog">举报帖子</el-button>
                        <el-button v-if="isAuthor" type="danger" plain size="small" @click="handleDelete">删除</el-button>
                    </div>
                </div>
            </div>

            <div class="pd-content">{{ post.content }}</div>

            <div v-if="post.images && post.images.length" class="pd-images">
                <img v-for="(img, index) in post.images" :key="index" :src="img" />
            </div>

            <div class="pd-actions">
                <span class="action-btn" :class="{ liked: post.is_liked }" @click="handleLike">
                    <el-icon><Pointer /></el-icon>
                    {{ post.likes_count || 0 }}
                </span>
                <span class="action-btn">
                    <el-icon><ChatLineSquare /></el-icon>
                    {{ post.comments_count || 0 }}
                </span>
                <span v-if="canReport" class="action-btn report-btn" @click="openReportDialog">举报</span>
            </div>

            <div v-if="post.comments" class="comments-section">
                <h3>评论（{{ post.comments.length }}）</h3>
                <div v-for="comment in post.comments" :key="comment.id" class="comment-item">
                    <el-avatar :size="32">{{ (comment.user_name || "")[0] }}</el-avatar>
                    <div class="comment-body">
                        <div class="comment-header">
                            <span class="comment-name">{{ comment.user_name }}</span>
                            <span class="comment-time">{{ comment.created_at }}</span>
                        </div>
                        <div class="comment-content">{{ comment.content }}</div>
                    </div>
                </div>
                <el-empty v-if="!post.comments.length" description="暂无评论" />
            </div>

            <div v-if="userStore.isLoggedIn" class="comment-input">
                <el-input v-model="commentText" placeholder="写下你的评论..." @keyup.enter="handleComment">
                    <template #append>
                        <el-button :disabled="!commentText.trim()" @click="handleComment">发送</el-button>
                    </template>
                </el-input>
            </div>
        </div>

        <el-dialog v-model="showReportDialog" title="举报帖子" width="420px" destroy-on-close>
            <el-form label-position="top">
                <el-form-item label="举报原因">
                    <el-select v-model="reportForm.reason" placeholder="请选择举报原因">
                        <el-option
                            v-for="option in REPORT_REASON_OPTIONS"
                            :key="option.value"
                            :label="option.label"
                            :value="option.value"
                        />
                    </el-select>
                </el-form-item>
                <el-form-item label="补充说明">
                    <el-input
                        v-model="reportForm.description"
                        type="textarea"
                        :rows="4"
                        maxlength="500"
                        show-word-limit
                        placeholder="可以补充更具体的情况，便于管理员判断"
                    />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="showReportDialog = false">取消</el-button>
                <el-button type="primary" :loading="reportSubmitting" @click="handleSubmitReport">提交举报</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "../utils/message";
import { ChatLineSquare, Pointer } from "../components/element-icons";
import { useUserStore } from "../stores/user";
import { createReport } from "../api/reports";
import { commentPost, deletePost, getPost, likePost } from "../api/posts";
import { REPORT_REASON_OPTIONS } from "../utils/report";

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

const post = ref(null);
const commentText = ref("");
const showReportDialog = ref(false);
const reportSubmitting = ref(false);
const reportForm = reactive({
    reason: "",
    description: ""
});

const isAuthor = computed(() => userStore.user?.id === post.value?.author_id);
const canReport = computed(() => userStore.isLoggedIn && userStore.user?.id !== post.value?.author_id);

function resetReportForm() {
    reportForm.reason = "";
    reportForm.description = "";
}

async function fetchPost() {
    try {
        post.value = (await getPost(route.params.id)).data;
    } catch {}
}

async function handleLike() {
    if (!userStore.isLoggedIn) {
        ElMessage.warning("请先登录");
        return;
    }

    try {
        const result = await likePost(post.value.id);
        post.value.is_liked = result.data.liked;
        post.value.likes_count += result.data.liked ? 1 : -1;
    } catch {}
}

async function handleComment() {
    if (!commentText.value.trim()) {
        return;
    }

    try {
        const result = await commentPost(post.value.id, commentText.value);
        post.value.comments.push(result.data);
        post.value.comments_count += 1;
        commentText.value = "";
        ElMessage.success("评论成功");
    } catch {}
}

function openReportDialog() {
    if (!canReport.value) {
        return;
    }
    resetReportForm();
    showReportDialog.value = true;
}

async function handleSubmitReport() {
    if (!reportForm.reason) {
        ElMessage.warning("请选择举报原因");
        return;
    }

    reportSubmitting.value = true;
    try {
        await createReport({
            target_type: "post",
            target_id: post.value.id,
            reason: reportForm.reason,
            description: reportForm.description
        });
        ElMessage.success("举报已提交");
        showReportDialog.value = false;
        resetReportForm();
    } finally {
        reportSubmitting.value = false;
    }
}

async function handleDelete() {
    try {
        await ElMessageBox.confirm("确认删除这条校园墙内容？删除后无法恢复。", "删除确认", {
            type: "warning"
        });
        await deletePost(post.value.id);
        ElMessage.success("已删除");
        router.push("/school-circle");
    } catch {}
}

onMounted(fetchPost);
</script>

<style scoped>
.post-detail-container {
    max-width: 700px;
}

.pd-author {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 16px 0;
}

.pd-author-main {
    display: flex;
    flex: 1;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
}

.pd-author-actions {
    display: flex;
    gap: 8px;
    align-items: center;
}

.author-name {
    font-size: 15px;
    font-weight: 600;
}

.post-time {
    font-size: 12px;
    color: var(--text-tertiary);
}

.pd-content {
    padding: 12px 0;
    font-size: 16px;
    line-height: 1.8;
    white-space: pre-wrap;
    word-break: break-word;
}

.pd-images {
    padding: 12px 0;
}

.pd-images img {
    width: 100%;
    margin-bottom: 8px;
    border-radius: var(--radius);
}

.pd-actions {
    display: flex;
    gap: 24px;
    padding: 12px 0;
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
}

.action-btn {
    display: flex;
    gap: 4px;
    align-items: center;
    font-size: 14px;
    color: var(--text-tertiary);
    cursor: pointer;
}

.action-btn.liked {
    color: var(--primary);
}

.report-btn {
    margin-left: auto;
}

.comments-section {
    padding: 16px 0;
}

.comments-section h3 {
    margin-bottom: 12px;
    font-size: 15px;
}

.comment-item {
    display: flex;
    gap: 10px;
    padding: 10px 0;
    border-bottom: 1px solid var(--bg-tertiary);
}

.comment-body {
    flex: 1;
}

.comment-header {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 4px;
}

.comment-name {
    font-size: 13px;
    font-weight: 500;
}

.comment-time {
    font-size: 11px;
    color: var(--text-tertiary);
}

.comment-content {
    font-size: 14px;
    line-height: 1.5;
}

.comment-input {
    position: sticky;
    bottom: 64px;
    padding: 12px 0;
    background: var(--bg-secondary);
}
</style>
