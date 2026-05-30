import api from "./index";
export const sendMessage = (rid,c) => api.post("/messages", { receiver_id: rid, content: c });
export const getConversation = (uid,p) => api.get("/messages/conversation/" + uid, { params: p });
export const getConversations = () => api.get("/messages/conversations");
export const getUnreadCount = () => api.get("/messages/unread");