import axios from "axios";
import { ElMessage } from "element-plus";
import { useUserStore } from "../stores/user";

const api = axios.create({ baseURL: "/api", timeout: 15000 });

api.interceptors.request.use((config) => {
    const userStore = useUserStore();
    if (userStore.token) config.headers.Authorization = "Bearer " + userStore.token;
    return config;
});

api.interceptors.response.use(
    (res) => { if (res.data.code !== 200 && res.data.code !== undefined) { ElMessage.error(res.data.message || "????"); return Promise.reject(new Error(res.data.message)); } return res.data; },
    (err) => { if (err.response?.status === 401) { const us = useUserStore(); us.logout(); ElMessage.error("?????"); window.location.href = "/login"; } else { ElMessage.error(err.message || "????"); } return Promise.reject(err); }
);
export default api;
