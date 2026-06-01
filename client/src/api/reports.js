import api from "./index";

export const createReport = (payload) => api.post("/reports", payload);
export const getMyReports = () => api.get("/reports/my/list");
