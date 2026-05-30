<template>
<div class="auth-page"><div class="auth-card">
<div class="auth-header"><div class="auth-logo">C</div><h1>??????</h1><p>????????</p></div>
<el-form :model="form" :rules="rules" ref="formRef" size="large" @submit.prevent="handleRegister">
<el-form-item prop="username"><el-input v-model="form.username" placeholder="???" :prefix-icon="User"/></el-form-item>
<el-form-item prop="nickname"><el-input v-model="form.nickname" placeholder="??" :prefix-icon="Edit"/></el-form-item>
<el-form-item prop="password"><el-input v-model="form.password" type="password" placeholder="??(??6?)" :prefix-icon="Lock" show-password/></el-form-item>
<el-form-item prop="passwordConfirm"><el-input v-model="form.passwordConfirm" type="password" placeholder="????" :prefix-icon="Lock" show-password/></el-form-item>
<el-form-item><el-button type="primary" native-type="submit" :loading="loading" style="width:100%">??</el-button></el-form-item>
</el-form>
<div class="auth-footer">?????<router-link to="/login">????</router-link></div>
</div></div>
</template>
<script setup>
import { ref,reactive } from "vue";import { useRouter } from "vue-router";import { ElMessage } from "element-plus";import { useUserStore } from "../stores/user";import { register as regApi } from "../api/auth";
import { User, Edit, Lock } from "@element-plus/icons-vue";
const router=useRouter(),userStore=useUserStore(),formRef=ref(null),loading=ref(false);
const form=reactive({username:"",nickname:"",password:"",passwordConfirm:""});
const rules={username:[{required:true,message:"??????",trigger:"blur"}],password:[{required:true,message:"?????",trigger:"blur"},{validator:(r,v,cb)=>{if(v.length<6)cb(new Error("????6?"));else cb();},trigger:"blur"}],passwordConfirm:[{required:true,message:"?????",trigger:"blur"},{validator:(r,v,cb)=>{if(v!==form.password)cb(new Error("?????????"));else cb();},trigger:"blur"}]};
async function handleRegister(){const v=await formRef.value.validate().catch(()=>false);if(!v)return;loading.value=true;try{const r=await regApi(form.username,form.password,form.nickname||form.username);userStore.setAuth(r.data.token,r.data.user);ElMessage.success("????");router.push("/home");}catch{}finally{loading.value=false;}}
</script>
<style scoped>
.auth-page{min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg-secondary);padding:20px;}
.auth-card{width:400px;background:var(--bg-primary);border-radius:12px;padding:40px;box-shadow:var(--shadow-md);}
.auth-header{text-align:center;margin-bottom:32px;}
.auth-logo{width:56px;height:56px;background:var(--primary);color:#fff;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:28px;margin:0 auto 16px;}
.auth-header h1{font-size:22px;font-weight:600;margin-bottom:8px;}
.auth-header p{font-size:14px;color:var(--text-secondary);}
.auth-footer{text-align:center;font-size:14px;color:var(--text-secondary);}
.auth-footer a{color:var(--primary);}
</style>
