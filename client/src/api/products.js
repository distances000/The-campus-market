import api from "./index";
export const getProducts = (p) => api.get("/products", { params: p });
export const getProduct = (id) => api.get("/products/" + id);
export const createProduct = (d) => api.post("/products", d);
export const updateProduct = (id,d) => api.put("/products/" + id, d);
export const deleteProduct = (id) => api.delete("/products/" + id);
export const toggleFavorite = (id) => api.post("/products/" + id + "/favorite");
export const getMyProducts = (p) => api.get("/products/my/list", { params: p });