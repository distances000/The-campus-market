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
