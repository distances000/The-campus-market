export const ORDER_STATUS_META = {
    pending_completion: { label: "待完成", type: "warning" },
    completed: { label: "已完成", type: "success" },
    cancelled: { label: "已取消", type: "info" }
};

export function getOrderStatusMeta(status) {
    return ORDER_STATUS_META[status] || { label: status || "未知", type: "info" };
}
