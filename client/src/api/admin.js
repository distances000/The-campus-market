import api from "./index";

export const bootstrapAdmin = () => api.post("/admin/bootstrap");
export const getAdminReports = (params) => api.get("/admin/reports", { params });
export const getAdminReport = (id) => api.get("/admin/reports/" + id);
export const updateAdminReport = (id, payload) => api.patch("/admin/reports/" + id, payload);
export const getAdminPasswordResets = (params) => api.get("/admin/password-resets", { params });
export const getAdminPasswordReset = (id) => api.get("/admin/password-resets/" + id);
export const updateAdminPasswordReset = (id, payload) => api.patch("/admin/password-resets/" + id, payload);
