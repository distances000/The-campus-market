<template>
    <div class="publish-page">
        <div class="page-container publish-container" v-loading="loadingProduct">
            <h2 class="page-title">{{ pageTitle }}</h2>

            <el-form ref="formRef" :model="form" :rules="rules" label-position="top" size="large">
                <el-form-item label="商品图片">
                    <div class="upload-section">
                        <div class="upload-header">
                            <div class="upload-copy">
                                <strong>上传清晰实拍图</strong>
                                <span>
                                    支持 {{ allowedExtensionsText }}，
                                    单张不超过 {{ maxSizeText }}，
                                    最多 {{ maxImageCount }} 张
                                </span>
                            </div>
                            <span class="upload-counter">{{ form.images.length }}/{{ maxImageCount }}</span>
                        </div>

                        <div class="upload-area">
                            <div v-for="(img, index) in form.images" :key="img" class="upload-item">
                                <img :src="img" alt="商品图片预览" />
                                <button
                                    type="button"
                                    class="upload-remove"
                                    aria-label="删除图片"
                                    @click="removeImage(index)"
                                >
                                    ×
                                </button>
                            </div>

                            <div v-if="uploading" class="upload-item upload-item-pending" aria-live="polite">
                                <span class="upload-spinner" aria-hidden="true"></span>
                                <span>上传中</span>
                            </div>

                            <el-upload
                                v-if="form.images.length < maxImageCount && !uploading"
                                :show-file-list="false"
                                :http-request="handleUpload"
                                accept=".jpg,.jpeg,.png,.gif,.webp"
                                class="upload-trigger"
                            >
                                <div class="upload-placeholder">
                                    <el-icon><Plus /></el-icon>
                                    <span>添加图片</span>
                                </div>
                            </el-upload>
                        </div>

                        <div v-if="uploadError" class="upload-feedback upload-feedback-error">
                            {{ uploadError }}
                        </div>
                        <div v-else class="upload-feedback">
                            上传成功后会生成 `/uploads/文件名` 静态访问路径。
                        </div>
                    </div>
                </el-form-item>

                <el-form-item label="商品标题" prop="title">
                    <el-input
                        v-model="form.title"
                        placeholder="请输入商品标题"
                        maxlength="60"
                        show-word-limit
                    />
                </el-form-item>

                <el-form-item label="商品描述" prop="description">
                    <el-input
                        v-model="form.description"
                        type="textarea"
                        :rows="4"
                        placeholder="请描述商品成色、规格、使用情况等"
                        maxlength="500"
                        show-word-limit
                    />
                </el-form-item>

                <el-row :gutter="16">
                    <el-col :span="12">
                        <el-form-item label="售价" prop="price">
                            <el-input v-model.number="form.price" placeholder="0.00">
                                <template #prefix>¥</template>
                            </el-input>
                        </el-form-item>
                    </el-col>
                    <el-col :span="12">
                        <el-form-item label="原价（选填）">
                            <el-input v-model.number="form.original_price" placeholder="0.00">
                                <template #prefix>¥</template>
                            </el-input>
                        </el-form-item>
                    </el-col>
                </el-row>

                <el-row :gutter="16">
                    <el-col :span="12">
                        <el-form-item label="分类">
                            <el-select v-model="form.category" style="width: 100%">
                                <el-option
                                    v-for="option in productCategoryOptions"
                                    :key="option.value"
                                    :label="option.label"
                                    :value="option.value"
                                />
                            </el-select>
                        </el-form-item>
                    </el-col>
                    <el-col :span="12">
                        <el-form-item label="成色">
                            <el-select v-model="form.condition" style="width: 100%">
                                <el-option label="全新" value="brand_new" />
                                <el-option label="几乎全新" value="like_new" />
                                <el-option label="二手" value="used" />
                                <el-option label="较旧" value="old" />
                            </el-select>
                        </el-form-item>
                    </el-col>
                </el-row>

                <el-form-item label="校区">
                    <el-select v-model="form.campus" style="width: 100%" placeholder="请选择校区">
                        <el-option
                            v-for="option in campusOptions"
                            :key="option.value"
                            :label="option.label"
                            :value="option.value"
                        />
                    </el-select>
                </el-form-item>

                <el-form-item>
                    <el-button
                        type="primary"
                        size="large"
                        class="submit-button"
                        :loading="submitting"
                        :disabled="!isFormValid || loadingProduct || uploading"
                        @click="handleSubmit"
                    >
                        {{ submitText }}
                    </el-button>
                </el-form-item>
            </el-form>
        </div>
    </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "../utils/message";
import { useUserStore } from "../stores/user";
import { createProduct, getProduct, updateProduct } from "../api/products";
import { uploadImage } from "../api/upload";
import { CAMPUS_OPTIONS, PRODUCT_CATEGORY_OPTIONS } from "../utils/options";
import { formatUploadSize, UPLOAD_LIMITS, validateImageFile } from "../utils/upload";
import { Plus } from "../components/element-icons";

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const formRef = ref(null);
const submitting = ref(false);
const loadingProduct = ref(false);
const uploading = ref(false);
const uploadError = ref("");
const campusOptions = CAMPUS_OPTIONS;
const productCategoryOptions = PRODUCT_CATEGORY_OPTIONS;
const maxImageCount = UPLOAD_LIMITS.maxImageCount;
const maxSizeText = formatUploadSize(UPLOAD_LIMITS.maxImageSizeBytes);
const allowedExtensionsText = UPLOAD_LIMITS.allowedExtensions
    .map((item) => item.replace(".", "").toUpperCase())
    .join(" / ");

const form = reactive({
    images: [],
    title: "",
    description: "",
    price: null,
    original_price: null,
    category: "other",
    condition: "used",
    campus: ""
});

const isEditMode = computed(() => !!route.params.id);
const pageTitle = computed(() => (isEditMode.value ? "编辑商品" : "发布商品"));
const submitText = computed(() => (isEditMode.value ? "保存修改" : "发布商品"));
const rules = {
    title: [{ required: true, message: "请输入商品标题", trigger: "blur" }],
    description: [{ required: true, message: "请输入商品描述", trigger: "blur" }],
    price: [{ required: true, message: "请输入售价", trigger: "blur" }]
};
const isFormValid = computed(() => !!form.title && !!form.description && form.price && form.price > 0);

function resetForm() {
    form.images = [];
    form.title = "";
    form.description = "";
    form.price = null;
    form.original_price = null;
    form.category = "other";
    form.condition = "used";
    form.campus = userStore.user?.campus || "";
    uploadError.value = "";
}

function applyProduct(product) {
    resetForm();
    if (!product) {
        return;
    }

    form.images = Array.isArray(product.images) ? [...product.images] : [];
    form.title = product.title || "";
    form.description = product.description || "";
    form.price = product.price ?? null;
    form.original_price = product.original_price ?? null;
    form.category = product.category || "other";
    form.condition = product.condition || "used";
    form.campus = product.campus || "";
}

async function loadProduct() {
    if (!isEditMode.value) {
        resetForm();
        return;
    }

    loadingProduct.value = true;
    try {
        const response = await getProduct(route.params.id);
        const product = response.data;
        if (!product || product.seller_id !== userStore.user?.id) {
            ElMessage.error("你只能编辑自己发布的商品");
            await router.replace("/profile");
            return;
        }
        applyProduct(product);
    } catch {
        ElMessage.error("商品加载失败");
        await router.replace("/profile");
    } finally {
        loadingProduct.value = false;
    }
}

async function handleUpload(options) {
    const file = options?.file;
    const validationMessage = validateImageFile(file, form.images.length);
    if (validationMessage) {
        uploadError.value = validationMessage;
        ElMessage.warning(validationMessage);
        return;
    }

    uploadError.value = "";
    uploading.value = true;

    try {
        const response = await uploadImage(file);
        form.images.push(response.data.url);
    } catch (error) {
        uploadError.value = error?.message || "图片上传失败，请稍后重试";
    } finally {
        uploading.value = false;
    }
}

function removeImage(index) {
    form.images.splice(index, 1);
    if (!form.images.length) {
        uploadError.value = "";
    }
}

async function handleSubmit() {
    const valid = await formRef.value.validate().catch(() => false);
    if (!valid) {
        return;
    }

    submitting.value = true;
    try {
        const payload = {
            title: form.title,
            description: form.description,
            price: form.price,
            original_price: form.original_price || undefined,
            category: form.category,
            condition: form.condition,
            campus: form.campus,
            images_json: JSON.stringify(form.images)
        };
        const response = isEditMode.value
            ? await updateProduct(route.params.id, payload)
            : await createProduct(payload);
        ElMessage.success(isEditMode.value ? "修改成功" : "发布成功");
        await router.push("/product/" + response.data.id);
    } catch {
        // 统一错误提示由接口层处理
    } finally {
        submitting.value = false;
    }
}

watch(() => route.params.id, loadProduct, { immediate: true });

onMounted(() => {
    if (!isEditMode.value) {
        resetForm();
    }
});
</script>

<style scoped>
.publish-page {
    padding: 20px 0;
}

.publish-container {
    max-width: 640px;
}

.page-title {
    margin-bottom: 24px;
    font-size: 20px;
    font-weight: 700;
    color: var(--text-primary);
}

.upload-section {
    display: grid;
    gap: 12px;
    padding: 18px;
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.76);
    border: 1px solid rgba(194, 199, 208, 0.18);
    box-shadow: var(--shadow);
}

.upload-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
}

.upload-copy {
    display: grid;
    gap: 6px;
}

.upload-copy strong {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-primary);
}

.upload-copy span,
.upload-feedback {
    font-size: 12px;
    line-height: 1.7;
    color: var(--text-tertiary);
}

.upload-feedback-error {
    color: var(--danger);
}

.upload-counter {
    padding: 4px 10px;
    border-radius: 999px;
    background: rgba(214, 227, 255, 0.72);
    font-size: 12px;
    font-weight: 700;
    color: var(--primary);
}

.upload-area {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
}

.upload-item,
.upload-placeholder {
    width: 92px;
    height: 92px;
    border-radius: 20px;
}

.upload-item {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(194, 199, 208, 0.22);
    background: rgba(245, 247, 252, 0.96);
}

.upload-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.upload-remove {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 999px;
    background: rgba(27, 27, 33, 0.68);
    color: #fff;
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
}

.upload-item-pending {
    display: grid;
    place-items: center;
    gap: 6px;
    color: var(--text-secondary);
}

.upload-item-pending span:last-child {
    font-size: 12px;
    font-weight: 700;
}

.upload-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid rgba(65, 95, 145, 0.18);
    border-top-color: var(--primary);
    border-radius: 999px;
    animation: upload-spin 0.8s linear infinite;
}

.upload-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border: 2px dashed rgba(194, 199, 208, 0.48);
    color: var(--text-tertiary);
    background: rgba(248, 250, 255, 0.88);
    transition: border-color 0.2s ease, color 0.2s ease, background-color 0.2s ease;
}

.upload-placeholder:hover {
    border-color: var(--primary);
    color: var(--primary);
    background: rgba(214, 227, 255, 0.24);
}

.upload-placeholder .el-icon {
    font-size: 24px;
}

.upload-placeholder span {
    font-size: 12px;
    font-weight: 700;
}

.submit-button {
    width: 100%;
}

@keyframes upload-spin {
    from {
        transform: rotate(0deg);
    }
    to {
        transform: rotate(360deg);
    }
}

@media (max-width: 640px) {
    .upload-section {
        padding: 16px;
        border-radius: 22px;
    }

    .upload-header {
        flex-direction: column;
    }
}
</style>
