export const PRODUCT_STATUS_META = {
    active: { label: "在售", type: "success" },
    sold: { label: "已售出", type: "warning" },
    inactive: { label: "已下架", type: "info" }
};

export const PRODUCT_CONDITION_MAP = {
    brand_new: "全新",
    like_new: "几乎全新",
    used: "二手",
    old: "较旧"
};

export const PRODUCT_CATEGORY_MAP = {
    digital: "数码",
    books: "书籍",
    life: "生活",
    clothing: "服饰",
    sports: "运动",
    beauty: "美妆",
    other: "其他"
};

export function getProductStatusMeta(status) {
    return PRODUCT_STATUS_META[status] || { label: status || "未知", type: "info" };
}
