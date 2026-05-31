<template>
<div class="publish-page"><div class="page-container" style="max-width:600px" v-loading="loadingProduct">
<h2 class="page-title">{{ pageTitle }}</h2>
<el-form :model="form" :rules="rules" ref="formRef" label-position="top" size="large">
<el-form-item label="商品图片">
    <div class="upload-area">
        <div v-for="(img,i) in form.images" :key="i" class="upload-item">
            <img :src="img" alt="商品图片"/>
            <span class="upload-remove" @click="removeImage(i)">&times;</span>
        </div>
        <el-upload v-if="form.images.length<9" :show-file-list="false" :http-request="handleUpload" accept="image/*" class="upload-trigger">
            <div class="upload-placeholder">
                <el-icon><Plus/></el-icon>
                <span>{{form.images.length}}/9</span>
            </div>
        </el-upload>
    </div>
</el-form-item>
<el-form-item label="商品标题" prop="title"><el-input v-model="form.title" placeholder="请输入商品标题" maxlength="60" show-word-limit/></el-form-item>
<el-form-item label="商品描述" prop="description"><el-input v-model="form.description" type="textarea" :rows="4" placeholder="请描述商品成色、规格、使用情况等" maxlength="500" show-word-limit/></el-form-item>
<el-row :gutter="16">
    <el-col :span="12"><el-form-item label="售价" prop="price"><el-input v-model.number="form.price" placeholder="0.00"><template #prefix>¥</template></el-input></el-form-item></el-col>
    <el-col :span="12"><el-form-item label="原价(选填)"><el-input v-model.number="form.original_price" placeholder="0.00"><template #prefix>¥</template></el-input></el-form-item></el-col>
</el-row>
<el-row :gutter="16">
    <el-col :span="12">
        <el-form-item label="分类">
            <el-select v-model="form.category" style="width:100%">
                <el-option v-for="option in productCategoryOptions" :key="option.value" :label="option.label" :value="option.value"/>
            </el-select>
        </el-form-item>
    </el-col>
    <el-col :span="12">
        <el-form-item label="成色">
            <el-select v-model="form.condition" style="width:100%">
                <el-option label="全新" value="brand_new"/><el-option label="几乎全新" value="like_new"/><el-option label="二手" value="used"/><el-option label="较旧" value="old"/>
            </el-select>
        </el-form-item>
    </el-col>
</el-row>
<el-form-item label="校区">
    <el-select v-model="form.campus" style="width:100%" placeholder="请选择校区">
        <el-option v-for="option in campusOptions" :key="option.value" :label="option.label" :value="option.value"/>
    </el-select>
</el-form-item>
<el-form-item>
    <el-button type="primary" size="large" style="width:100%" :loading="submitting" :disabled="!isFormValid || loadingProduct" @click="handleSubmit">{{ submitText }}</el-button>
</el-form-item>
</el-form>
</div></div>
</template>
<script setup>
import { ref, reactive, computed, watch, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "../utils/message";
import { useUserStore } from "../stores/user";
import { createProduct, getProduct, updateProduct } from "../api/products";
import { uploadImage } from "../api/upload";
import { CAMPUS_OPTIONS, PRODUCT_CATEGORY_OPTIONS } from "../utils/options";
import { Plus } from "../components/element-icons";

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const formRef = ref(null);
const submitting = ref(false);
const loadingProduct = ref(false);
const campusOptions = CAMPUS_OPTIONS;
const productCategoryOptions = PRODUCT_CATEGORY_OPTIONS;
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
const pageTitle = computed(() => isEditMode.value ? "编辑商品" : "发布商品");
const submitText = computed(() => isEditMode.value ? "保存修改" : "发布商品");
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
}

function applyProduct(p) {
    resetForm();
    if (!p) return;
    form.images = Array.isArray(p.images) ? [...p.images] : [];
    form.title = p.title || "";
    form.description = p.description || "";
    form.price = p.price ?? null;
    form.original_price = p.original_price ?? null;
    form.category = p.category || "other";
    form.condition = p.condition || "used";
    form.campus = p.campus || "";
}

async function loadProduct() {
    if (!isEditMode.value) {
        resetForm();
        return;
    }
    loadingProduct.value = true;
    try {
        const r = await getProduct(route.params.id);
        const p = r.data;
        if (!p || p.seller_id !== userStore.user?.id) {
            ElMessage.error("你只能编辑自己发布的商品");
            await router.replace("/profile");
            return;
        }
        applyProduct(p);
    } catch {
        ElMessage.error("商品加载失败");
        await router.replace("/profile");
    } finally {
        loadingProduct.value = false;
    }
}

async function handleUpload(o) {
    try {
        const r = await uploadImage(o.file);
        form.images.push(r.data.url);
        o.onSuccess?.(r);
    } catch (err) {
        o.onError?.(err);
        ElMessage.error("图片上传失败");
    }
}

function removeImage(i) {
    form.images.splice(i, 1);
}

async function handleSubmit() {
    const valid = await formRef.value.validate().catch(() => false);
    if (!valid) return;
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
        const r = isEditMode.value ? await updateProduct(route.params.id, payload) : await createProduct(payload);
        ElMessage.success(isEditMode.value ? "修改成功" : "发布成功");
        await router.push("/product/" + r.data.id);
    } catch {} finally {
        submitting.value = false;
    }
}

watch(() => route.params.id, loadProduct, { immediate: true });
onMounted(() => {
    if (!isEditMode.value) resetForm();
});
</script>
<style scoped>
.publish-page{padding:20px 0;}.page-title{font-size:20px;font-weight:600;margin-bottom:24px;}
.upload-area{display:flex;flex-wrap:wrap;gap:10px;}
.upload-item{width:88px;height:88px;border-radius:var(--radius);overflow:hidden;position:relative;border:1px solid var(--border);}
.upload-item img{width:100%;height:100%;object-fit:cover;}
.upload-remove{position:absolute;top:-2px;right:-2px;width:20px;height:20px;background:rgba(0,0,0,0.6);color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;cursor:pointer;line-height:1;}
.upload-placeholder{width:88px;height:88px;border:2px dashed var(--border);border-radius:var(--radius);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:var(--text-tertiary);cursor:pointer;font-size:12px;transition:border-color 0.2s;}
.upload-placeholder:hover{border-color:var(--primary);color:var(--primary);}
.upload-placeholder .el-icon{font-size:24px;}
</style>
