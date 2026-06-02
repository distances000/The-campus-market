import axios from "axios";
import { ElMessage } from "../utils/message";
import { useUserStore } from "../stores/user";

const api = axios.create({ baseURL: "/api", timeout: 15000 });

api.interceptors.request.use((config) => {
    const userStore = useUserStore();
    if (userStore.token) config.headers.Authorization = "Bearer " + userStore.token;
    return config;
});

function getServerMessage(error) {
    return error?.response?.data?.message || error?.response?.data?.error || "";
}

function isUnsafeErrorMessage(message) {
    if (!message) {
        return true;
    }
    return /error:|exception|stack|sql|mysql|sequelize|timeout of \d+ms exceeded|network error|cannot |unexpected |econn|er_|failed to|syntaxerror|referenceerror|typeerror/i.test(message);
}

function getFallbackMessageByStatus(status, fallback = "请求失败，请稍后再试") {
    if (status === 400) return "请求参数有误，请检查后重试";
    if (status === 401) return "登录状态已失效，请重新登录";
    if (status === 403) return "当前没有权限执行此操作";
    if (status === 404) return "请求的内容不存在或已被删除";
    if (status === 409) return "当前操作冲突，请刷新后再试";
    if (status === 422) return "提交内容不符合要求，请检查后重试";
    if (status === 429) return "请求过于频繁，请稍后再试";
    if (status >= 500) return "服务暂时不可用，请稍后再试";
    return fallback;
}

function normalizeUserMessage(rawMessage, status, fallback) {
    const message = String(rawMessage || "").trim();
    if (!message || isUnsafeErrorMessage(message)) {
        return getFallbackMessageByStatus(status, fallback);
    }
    return message;
}

api.interceptors.response.use(
    (res) => {
        if (res.data.code !== 200 && res.data.code !== undefined) {
            const message = normalizeUserMessage(res.data.message, res.data.code, "请求失败，请稍后再试");
            ElMessage.error(message);
            return Promise.reject(new Error(message));
        }
        return res.data;
    },
    (err) => {
        const status = err.response?.status;
        const serverMessage = getServerMessage(err);
        if (status === 401) {
            const us = useUserStore();
            us.logout();
            ElMessage.error(normalizeUserMessage(serverMessage, status, "登录状态已失效，请重新登录"));
            window.location.href = "/login";
        } else if (status === 429) {
            ElMessage.warning(normalizeUserMessage(serverMessage, status, "请求过于频繁，请稍后再试"));
        } else {
            ElMessage.error(normalizeUserMessage(serverMessage || err.message, status, "请求失败，请稍后再试"));
        }
        return Promise.reject(err);
    }
);

export default api;
