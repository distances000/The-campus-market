import api from "./index";

export const createReport = (payload) => api.post("/reports", payload);
export const getMyReports = () => api.get("/reports/my/list");
export {
    bootstrapAdmin,
    getAdminReport,
    getAdminReports,
    getAdminPasswordReset,
    getAdminPasswordResets,
    updateAdminReport,
    updateAdminPasswordReset
} from "./admin";
