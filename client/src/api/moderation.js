import api from "./index";

export const getModerationReports = (params) => api.get("/moderation/reports", { params });
export const getModerationReport = (id) => api.get("/moderation/reports/" + id);
export const updateModerationReport = (id, payload) => api.patch("/moderation/reports/" + id, payload);
export const getModerationPasswordResets = (params) => api.get("/moderation/password-resets", { params });
export const getModerationPasswordReset = (id) => api.get("/moderation/password-resets/" + id);
export const updateModerationPasswordReset = (id, payload) => api.patch("/moderation/password-resets/" + id, payload);
