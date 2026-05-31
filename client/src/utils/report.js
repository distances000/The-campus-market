export const REPORT_REASON_OPTIONS = [
    { value: "spam", label: "垃圾信息" },
    { value: "fraud", label: "欺诈交易" },
    { value: "illegal", label: "违禁违规" },
    { value: "abuse", label: "人身攻击" },
    { value: "misleading", label: "信息失实" },
    { value: "other", label: "其他原因" }
];

export const REPORT_REASON_MAP = REPORT_REASON_OPTIONS.reduce((result, item) => {
    result[item.value] = item.label;
    return result;
}, {});

export const REPORT_STATUS_OPTIONS = [
    { value: "pending", label: "待处理" },
    { value: "reviewing", label: "处理中" },
    { value: "resolved", label: "已处理" },
    { value: "rejected", label: "已驳回" }
];

export const REPORT_STATUS_META = {
    pending: { label: "待处理", type: "warning" },
    reviewing: { label: "处理中", type: "primary" },
    resolved: { label: "已处理", type: "success" },
    rejected: { label: "已驳回", type: "info" }
};

export const REPORT_TARGET_TYPE_MAP = {
    product: "商品",
    post: "帖子"
};

export const REPORT_TARGET_TYPE_OPTIONS = [
    { value: "product", label: "商品" },
    { value: "post", label: "帖子" }
];

export const REPORT_ACTION_OPTIONS = [
    { value: "none", label: "不执行动作" },
    { value: "hide_product", label: "下架商品" },
    { value: "delete_post", label: "删除帖子" }
];

export const REPORT_ACTION_MAP = REPORT_ACTION_OPTIONS.reduce((result, item) => {
    result[item.value] = item.label;
    return result;
}, {});

export function getReportStatusMeta(status) {
    return REPORT_STATUS_META[status] || { label: status || "未知", type: "info" };
}

export function getReportTargetTypeLabel(targetType) {
    return REPORT_TARGET_TYPE_MAP[targetType] || targetType || "未知";
}

export function getReportActionLabel(action) {
    return REPORT_ACTION_MAP[action] || action || "未知";
}
