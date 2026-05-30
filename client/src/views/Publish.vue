<template>
<div class="publish-page"><div class="page-container" style="max-width:600px">
<h2 class="page-title">????</h2>
<el-form :model="form" :rules="rules" ref="formRef" label-position="top" size="large">
<el-form-item label="????"><div class="upload-area"><div v-for="(img,i) in form.images" :key="i" class="upload-item"><img :src="img"/><span class="upload-remove" @click="removeImage(i)">&times;</span></div>
<el-upload v-if="form.images.length<9" :show-file-list="false" :http-request="handleUpload" accept="image/*" class="upload-trigger"><div class="upload-placeholder"><el-icon><Plus/></el-icon><span>{{form.images.length}}/9</span></div></el-upload></div></el-form-item>
<el-form-item label="????" prop="title"><el-input v-model="form.title" placeholder="???????" maxlength="60" show-word-limit/></el-form-item>
<el-form-item label="????" prop="description"><el-input v-model="form.description" type="textarea" :rows="4" placeholder="???????????" maxlength="500" show-word-limit/></el-form-item>
<el-row :gutter="16"><el-col :span="12"><el-form-item label="??" prop="price"><el-input v-model.number="form.price" placeholder="0.00"><template #prefix>&yen;</template></el-input></el-form-item></el-col>
<el-col :span="12"><el-form-item label="??(??)"><el-input v-model.number="form.original_price" placeholder="0.00"><template #prefix>&yen;</template></el-input></el-form-item></el-col></el-row>
<el-row :gutter="16"><el-col :span="12"><el-form-item label="??"><el-select v-model="form.category" style="width:100%"><el-option label="??" value="digital"/><el-option label="??" value="books"/><el-option label="??" value="life"/><el-option label="??" value="clothing"/><el-option label="??" value="sports"/><el-option label="??" value="beauty"/><el-option label="??" value="other"/></el-select></el-form-item></el-col>
<el-col :span="12"><el-form-item label="????"><el-select v-model="form.condition" style="width:100%"><el-option label="??" value="brand_new"/><el-option label="????" value="like_new"/><el-option label="??" value="used"/><el-option label="??" value="old"/></el-select></el-form-item></el-col></el-row>
<el-form-item label="????"><el-select v-model="form.campus" style="width:100%" placeholder="????"><el-option label="???" value="???"/><el-option label="???" value="???"/><el-option label="???" value="???"/><el-option label="???" value="???"/><el-option label="??" value="??"/></el-select></el-form-item>
<el-form-item><el-button type="primary" size="large" style="width:100%" :loading="submitting" :disabled="!isFormValid" @click="handlePublish">????</el-button></el-form-item>
</el-form>
</div></div>
</template>
<script setup>
import {ref,reactive,computed} from "vue";import {useRouter} from "vue-router";import {ElMessage} from "element-plus";import {createProduct} from "../api/products";import {uploadImage} from "../api/upload";
import { Plus } from "@element-plus/icons-vue";
const router=useRouter(),formRef=ref(null),submitting=ref(false);
const form=reactive({images:[],title:"",description:"",price:null,original_price:null,category:"other",condition:"used",campus:""});
const rules={title:[{required:true,message:"???????",trigger:"blur"}],description:[{required:true,message:"???????",trigger:"blur"}],price:[{required:true,message:"?????",trigger:"blur"}]};
const isFormValid=computed(()=>form.title&&form.description&&form.price&&form.price>0);
async function handleUpload(o){try{const r=await uploadImage(o.file);form.images.push(r.data.url);}catch{}}
function removeImage(i){form.images.splice(i,1);}
async function handlePublish(){const v=await formRef.value.validate().catch(()=>false);if(!v)return;submitting.value=true;try{await createProduct({title:form.title,description:form.description,price:form.price,original_price:form.original_price||undefined,category:form.category,condition:form.condition,campus:form.campus,images_json:JSON.stringify(form.images)});ElMessage.success("????");router.push("/home");}catch{}finally{submitting.value=false;}}
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
