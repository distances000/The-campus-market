import api from "./index";
export const login = (u,p) => api.post("/auth/login", { username: u, password: p });
export const register = (u,p,n) => api.post("/auth/register", { username: u, password: p, nickname: n });
export const getMe = () => api.get("/auth/me");
export const updateMe = (d) => api.put("/auth/me", d);
export const resetPassword = (currentPassword, newPassword) => api.post("/auth/reset-password", {
    current_password: currentPassword,
    new_password: newPassword
});
