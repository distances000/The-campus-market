import api from "./index";

export const createReport = (payload) => api.post("/reports", payload);
export const getMyReports = () => api.get("/reports/my/list");
export const bootstrapAdmin = () => api.post("/admin/bootstrap");
export const getAdminReports = (params) => api.get("/admin/reports", { params });
export const getAdminReport = (id) => api.get("/admin/reports/" + id);
export const updateAdminReport = (id, payload) => api.patch("/admin/reports/" + id, payload);
