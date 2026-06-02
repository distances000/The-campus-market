import api from "./index";

export const login = (username, password) => api.post("/auth/login", { username, password });
export const sendRegisterEmailCode = (email) => api.post("/auth/register/send-email-code", { email });
export const register = (username, password, nickname, email, emailCode) => api.post("/auth/register", {
    username,
    password,
    nickname,
    email,
    email_code: emailCode
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
