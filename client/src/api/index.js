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

api.interceptors.response.use(
    (res) => {
        if (res.data.code !== 200 && res.data.code !== undefined) {
            ElMessage.error(res.data.message || "请求失败");
            return Promise.reject(new Error(res.data.message || "请求失败"));
        }
        return res.data;
    },
    (err) => {
        const serverMessage = getServerMessage(err);
        if (err.response?.status === 401) {
            const us = useUserStore();
            us.logout();
            ElMessage.error(serverMessage || "登录状态已失效，请重新登录");
            window.location.href = "/login";
        } else if (err.response?.status === 429) {
            ElMessage.warning(serverMessage || "请求过于频繁，请稍后再试");
        } else {
            ElMessage.error(serverMessage || err.message || "请求失败");
        }
        return Promise.reject(err);
    }
);

export default api;
