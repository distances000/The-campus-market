import api from "./index";

export const login = (username, password) => api.post("/auth/login", { username, password });
export const sendRegisterPhoneCode = (phone) => api.post("/auth/register/send-code", { phone });
export const register = (username, password, nickname, phone, phoneCode) => api.post("/auth/register", {
    username,
    password,
    nickname,
    phone,
    phone_code: phoneCode
});
export const getMe = () => api.get("/auth/me");
export const updateMe = (payload) => api.put("/auth/me", payload);
export const logout = () => api.post("/auth/logout");
export const resetPassword = (currentPassword, newPassword) => api.post("/auth/reset-password", {
    current_password: currentPassword,
    new_password: newPassword
});
export const createPasswordResetRequest = (payload) => api.post("/auth/forgot-password/request", payload);
export const getPasswordResetStatus = (payload) => api.post("/auth/forgot-password/status", payload);
