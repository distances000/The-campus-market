import api from "./index";
export const getPosts = (p) => api.get("/posts", { params: p });
export const getPost = (id) => api.get("/posts/" + id);
export const createPost = (d) => api.post("/posts", d);
export const deletePost = (id) => api.delete("/posts/" + id);
export const likePost = (id) => api.post("/posts/" + id + "/like");
export const commentPost = (id,c) => api.post("/posts/" + id + "/comment", { content: c });
export const deleteComment = (pid,cid) => api.delete("/posts/" + pid + "/comment/" + cid);