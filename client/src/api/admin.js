import api from "./index";

export const getAdminStats = () => api.get("/admin/stats");
