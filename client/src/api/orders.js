import api from "./index";

export const createOrder = (productId) => api.post("/orders", { product_id: productId });
export const getMyOrders = (params) => api.get("/orders/my/list", { params });
export const completeOrder = (id) => api.post("/orders/" + id + "/complete");
export const cancelOrder = (id) => api.post("/orders/" + id + "/cancel");
export const reviewOrder = (id, data) => api.post("/orders/" + id + "/review", data);
export const getReceivedReviews = () => api.get("/orders/reviews/received");
