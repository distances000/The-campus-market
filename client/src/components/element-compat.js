import {
    defineComponent,
    h,
    ref,
    computed,
    provide,
    inject,
    Teleport,
    onBeforeUnmount,
    onMounted,
    watch
} from "vue";

const FormKey = Symbol("form");
const TableKey = Symbol("table");

function toCssSize(value) {
    if (value === undefined || value === null || value === "") {
        return "";
    }
    return typeof value === "number" ? `${value}px` : String(value);
}

function getNestedValue(target, path) {
    if (!target || !path) {
        return "";
    }
    return String(path)
        .split(".")
        .reduce((value, key) => (value === undefined || value === null ? "" : value[key]), target);
}

function createLoadingOverlay() {
    const overlay = document.createElement("div");
    overlay.className = "ui-loading-overlay";
    overlay.innerHTML = `
        <div class="ui-loading-card" role="status" aria-live="polite">
            <span class="ui-loading-spinner" aria-hidden="true"></span>
            <span class="ui-loading-text">加载中</span>
        </div>
    `;
    return overlay;
}

function setLoadingState(el, value) {
    if (!el) {
        return;
    }

    if (value) {
        if (el.__uiLoadingOverlay) {
            return;
        }

        const computedStyle = window.getComputedStyle(el);
        if (computedStyle.position === "static") {
            el.dataset.uiLoadingPosition = el.style.position || "";
            el.style.position = "relative";
        }

        const overlay = createLoadingOverlay();
        el.appendChild(overlay);
        el.__uiLoadingOverlay = overlay;
        el.classList.add("ui-loading-parent");
        return;
    }

    if (el.__uiLoadingOverlay) {
        el.__uiLoadingOverlay.remove();
        el.__uiLoadingOverlay = null;
    }

    el.classList.remove("ui-loading-parent");
    if (el.dataset.uiLoadingPosition !== undefined) {
        el.style.position = el.dataset.uiLoadingPosition;
        delete el.dataset.uiLoadingPosition;
    }
}

const LoadingDirective = {
    mounted(el, binding) {
        setLoadingState(el, !!binding.value);
    },
    updated(el, binding) {
        if (!!binding.oldValue !== !!binding.value) {
            setLoadingState(el, !!binding.value);
        }
    },
    unmounted(el) {
        setLoadingState(el, false);
    }
};

const ElForm = defineComponent({
    name: "ElForm",
    props: {
        model: { type: Object, default: () => ({}) },
        rules: { type: Object, default: () => ({}) },
        labelPosition: { type: String, default: "top" }
    },
    emits: ["submit"],
    setup(props, { slots, emit, expose }) {
        const items = ref([]);
        const registerItem = (item) => items.value.push(item);
        const unregisterItem = (item) => {
            items.value = items.value.filter((current) => current !== item);
        };

        provide(FormKey, { props, registerItem, unregisterItem });

        const validate = async () => {
            let valid = true;
            for (const item of items.value) {
                const ok = await item.validate();
                if (!ok) {
                    valid = false;
                }
            }
            return valid;
        };

        expose({ validate });

        return () => h("form", {
            class: "ui-form",
            onSubmit: (event) => {
                event.preventDefault();
                emit("submit", event);
            }
        }, slots.default ? slots.default() : []);
    }
});

const ElFormItem = defineComponent({
    name: "ElFormItem",
    props: {
        prop: { type: String, default: "" },
        label: { type: String, default: "" }
    },
    setup(props, { slots }) {
        const form = inject(FormKey, null);
        const errorMessage = ref("");

        const validate = async () => {
            errorMessage.value = "";
            if (!form || !props.prop) {
                return true;
            }

            const rules = form.props.rules?.[props.prop] || [];
            const value = form.props.model?.[props.prop];

            for (const rule of rules) {
                if (rule.required && (value === undefined || value === null || value === "")) {
                    errorMessage.value = rule.message || "字段必填";
                    return false;
                }
                if (typeof rule.validator === "function") {
                    const validationResult = await new Promise((resolve) => {
                        try {
                            rule.validator(rule, value, (error) => resolve(!error));
                        } catch {
                            resolve(false);
                        }
                    });
                    if (!validationResult) {
                        errorMessage.value = rule.message || "字段校验失败";
                        return false;
                    }
                }
            }
            return true;
        };

        const instance = { validate };
        if (form) {
            form.registerItem(instance);
            onBeforeUnmount(() => form.unregisterItem(instance));
        }

        return () => h("div", { class: ["ui-form-item", errorMessage.value ? "is-error" : ""] }, [
            props.label ? h("label", { class: "ui-form-item-label" }, props.label) : null,
            h("div", { class: "ui-form-item-control" }, slots.default ? slots.default() : []),
            errorMessage.value ? h("div", { class: "ui-form-item-error" }, errorMessage.value) : null
        ]);
    }
});

const ElButton = defineComponent({
    name: "ElButton",
    props: {
        type: { type: String, default: "default" },
        size: { type: String, default: "default" },
        loading: { type: Boolean, default: false },
        disabled: { type: Boolean, default: false },
        plain: { type: Boolean, default: false },
        text: { type: Boolean, default: false },
        nativeType: { type: String, default: "button" }
    },
    emits: ["click"],
    setup(props, { slots, emit }) {
        return () => h("button", {
            type: props.nativeType,
            class: [
                "ui-btn",
                `ui-btn-${props.type}`,
                props.plain ? "is-plain" : "",
                props.text ? "is-text" : "",
                props.loading ? "is-loading" : "",
                props.size === "large" ? "ui-btn-lg" : "",
                props.size === "small" ? "ui-btn-sm" : ""
            ],
            disabled: props.disabled || props.loading,
            onClick: (event) => emit("click", event)
        }, [props.loading ? h("span", { class: "ui-btn-loading" }, "加载中") : null, slots.default ? slots.default() : []]);
    }
});

const ElIcon = defineComponent({
    name: "ElIcon",
    setup(_, { slots }) {
        return () => h("span", { class: "ui-icon" }, slots.default ? slots.default() : []);
    }
});

const ElInput = defineComponent({
    name: "ElInput",
    props: {
        modelValue: { type: [String, Number], default: "" },
        type: { type: String, default: "text" },
        placeholder: { type: String, default: "" },
        disabled: { type: Boolean, default: false },
        rows: { type: Number, default: 3 },
        maxlength: { type: Number, default: undefined },
        showWordLimit: { type: Boolean, default: false }
    },
    emits: ["update:modelValue", "keyup", "blur", "change"],
    setup(props, { emit, slots, attrs }) {
        const valueText = computed(() => String(props.modelValue ?? ""));
        const baseClass = computed(() => ["ui-input-wrap", attrs.class]);

        const onInput = (event) => {
            emit("update:modelValue", event.target.value);
            emit("change", event.target.value);
        };

        const onKeyup = (event) => {
            emit("keyup", event);
        };

        const inputNode = props.type === "textarea"
            ? h("textarea", {
                class: "ui-textarea",
                value: valueText.value,
                placeholder: props.placeholder,
                disabled: props.disabled,
                rows: props.rows,
                maxlength: props.maxlength,
                onInput,
                onKeyup,
                onBlur: (event) => emit("blur", event)
            })
            : h("input", {
                class: "ui-input",
                value: valueText.value,
                type: props.type,
                placeholder: props.placeholder,
                disabled: props.disabled,
                maxlength: props.maxlength,
                onInput,
                onKeyup,
                onBlur: (event) => emit("blur", event)
            });

        return () => h("div", { class: baseClass.value }, [
            slots.prefix ? h("span", { class: "ui-input-prefix" }, slots.prefix()) : null,
            slots.prepend ? h("span", { class: "ui-input-prepend" }, slots.prepend()) : null,
            inputNode,
            slots.append ? h("span", { class: "ui-input-append" }, slots.append()) : null,
            props.showWordLimit
                ? h("span", { class: "ui-word-limit" }, `${valueText.value.length}/${props.maxlength || ""}`)
                : null
        ]);
    }
});

const ElSelect = defineComponent({
    name: "ElSelect",
    props: {
        modelValue: { type: [String, Number], default: "" },
        placeholder: { type: String, default: "" },
        disabled: { type: Boolean, default: false },
        clearable: { type: Boolean, default: false }
    },
    emits: ["update:modelValue", "change"],
    setup(props, { emit, slots, attrs }) {
        const onChange = (event) => {
            emit("update:modelValue", event.target.value);
            emit("change", event.target.value);
        };

        return () => h("select", {
            class: ["ui-select", attrs.class],
            value: props.modelValue,
            disabled: props.disabled,
            onChange
        }, [
            props.placeholder ? h("option", { value: "" }, props.placeholder) : null,
            slots.default ? slots.default() : []
        ]);
    }
});

const ElOption = defineComponent({
    name: "ElOption",
    props: {
        label: { type: String, default: "" },
        value: { type: [String, Number], required: true }
    },
    setup(props) {
        return () => h("option", { value: props.value }, props.label);
    }
});

const ElEmpty = defineComponent({
    name: "ElEmpty",
    props: {
        description: { type: String, default: "暂无数据" }
    },
    setup(props) {
        return () => h("div", { class: "ui-empty" }, props.description);
    }
});

const ElAvatar = defineComponent({
    name: "ElAvatar",
    props: {
        size: { type: [String, Number], default: 40 }
    },
    setup(props, { slots }) {
        const size = computed(() => typeof props.size === "number" ? `${props.size}px` : props.size);
        return () => h("span", {
            class: "ui-avatar",
            style: { width: size.value, height: size.value }
        }, slots.default ? slots.default() : []);
    }
});

const ElTag = defineComponent({
    name: "ElTag",
    props: { type: { type: String, default: "info" } },
    setup(props, { slots }) {
        return () => h("span", { class: ["ui-tag", `ui-tag-${props.type}`] }, slots.default ? slots.default() : []);
    }
});

const ElTableColumn = defineComponent({
    name: "ElTableColumn",
    props: {
        prop: { type: String, default: "" },
        label: { type: String, default: "" },
        width: { type: [String, Number], default: "" },
        minWidth: { type: [String, Number], default: "" },
        fixed: { type: String, default: "" },
        align: { type: String, default: "left" }
    },
    setup(props, { slots }) {
        const table = inject(TableKey, null);
        const column = { props, slots };

        onMounted(() => {
            table?.registerColumn(column);
        });
        onBeforeUnmount(() => {
            table?.unregisterColumn(column);
        });

        return () => null;
    }
});

const ElTable = defineComponent({
    name: "ElTable",
    props: {
        data: { type: Array, default: () => [] },
        rowKey: { type: String, default: "" },
        loading: { type: Boolean, default: false },
        highlightCurrentRow: { type: Boolean, default: false }
    },
    emits: ["row-click", "current-change"],
    setup(props, { slots, emit }) {
        const columns = ref([]);

        const registerColumn = (column) => {
            columns.value = [...columns.value, column];
        };

        const unregisterColumn = (column) => {
            columns.value = columns.value.filter((item) => item !== column);
        };

        provide(TableKey, { registerColumn, unregisterColumn });

        function renderCell(row, column, rowIndex) {
            if (typeof column.slots?.default === "function") {
                return column.slots.default({ row, column: column.props, $index: rowIndex });
            }

            const value = getNestedValue(row, column.props.prop);
            return value === "" || value === undefined || value === null ? " " : String(value);
        }

        function renderWidth(column) {
            return {
                width: toCssSize(column.props.width) || undefined,
                minWidth: toCssSize(column.props.minWidth) || undefined
            };
        }

        return () => h("div", {
            class: [
                "ui-table-wrapper",
                props.highlightCurrentRow ? "has-highlight" : "",
                props.loading ? "is-loading" : ""
            ]
        }, [
            h("div", { class: "ui-table-scroll" }, [
                h("table", { class: "ui-table" }, [
                    h("thead", { class: "ui-table-head" }, [
                        h("tr", {}, columns.value.map((column) => h("th", {
                            class: ["ui-table-cell", column.props.align ? `is-${column.props.align}` : ""],
                            style: renderWidth(column)
                        }, column.props.label || column.props.prop || "")))
                    ]),
                    h("tbody", { class: "ui-table-body" }, props.data.length
                        ? props.data.map((row, rowIndex) => h("tr", {
                            key: props.rowKey ? row?.[props.rowKey] : rowIndex,
                            class: [
                                "ui-table-row",
                                props.highlightCurrentRow ? "is-highlightable" : ""
                            ],
                            onClick: (event) => {
                                emit("row-click", row, rowIndex, event);
                            }
                        }, columns.value.map((column, columnIndex) => h("td", {
                            class: ["ui-table-cell", column.props.align ? `is-${column.props.align}` : ""],
                            style: renderWidth(column)
                        }, renderCell(row, column, rowIndex)))) )
                        : [h("tr", { class: "ui-table-empty-row" }, [
                            h("td", { colSpan: Math.max(columns.value.length, 1) }, [
                                h(ElEmpty, { description: "暂无数据" })
                            ])
                        ])]
                    )
                ])
            ]),
            props.loading ? h("div", { class: "ui-table-loading" }, "加载中") : null,
            slots.append ? h("div", { class: "ui-table-append" }, slots.append()) : null
        ]);
    }
});

const ElPagination = defineComponent({
    name: "ElPagination",
    props: {
        currentPage: { type: Number, default: 1 },
        pageSize: { type: Number, default: 10 },
        pageSizes: { type: Array, default: () => [10, 20, 50] },
        total: { type: Number, default: 0 },
        layout: { type: String, default: "total, sizes, prev, pager, next, jumper" }
    },
    emits: ["update:currentPage", "update:pageSize", "size-change", "current-change"],
    setup(props, { emit }) {
        const jumpValue = ref(String(props.currentPage || 1));

        watch(() => props.currentPage, (value) => {
            jumpValue.value = String(value || 1);
        });

        const totalPages = computed(() => Math.max(1, Math.ceil(props.total / Math.max(props.pageSize, 1))));
        const visiblePages = computed(() => {
            const pages = totalPages.value;
            const current = Math.min(Math.max(props.currentPage, 1), pages);
            if (pages <= 5) {
                return Array.from({ length: pages }, (_, index) => index + 1);
            }

            let start = Math.max(1, current - 2);
            let end = Math.min(pages, start + 4);
            start = Math.max(1, end - 4);
            return Array.from({ length: end - start + 1 }, (_, index) => start + index);
        });

        function goTo(page) {
            const nextPage = Math.min(Math.max(Number(page) || 1, 1), totalPages.value);
            if (nextPage === props.currentPage) {
                return;
            }
            emit("update:currentPage", nextPage);
            emit("current-change", nextPage);
        }

        function changeSize(event) {
            const nextSize = Number(event.target.value) || props.pageSize;
            if (nextSize === props.pageSize) {
                return;
            }
            emit("update:pageSize", nextSize);
            emit("size-change", nextSize);
            goTo(1);
        }

        function jumpToPage() {
            goTo(jumpValue.value);
        }

        function hasLayout(part) {
            return props.layout.split(",").map((item) => item.trim()).includes(part);
        }

        return () => h("div", { class: "ui-pagination" }, [
            hasLayout("total") ? h("span", { class: "ui-pagination-total" }, `共 ${props.total} 条`) : null,
            hasLayout("sizes") ? h("label", { class: "ui-pagination-size" }, [
                h("span", null, "每页"),
                h("select", {
                    value: props.pageSize,
                    onChange: changeSize
                }, props.pageSizes.map((size) => h("option", { value: size }, `${size} 条`)))
            ]) : null,
            hasLayout("prev") ? h("button", {
                type: "button",
                class: "ui-pagination-btn",
                disabled: props.currentPage <= 1,
                onClick: () => goTo(props.currentPage - 1)
            }, "上一页") : null,
            hasLayout("pager") ? h("div", { class: "ui-pagination-pages" }, visiblePages.value.map((page) => h("button", {
                key: page,
                type: "button",
                class: ["ui-pagination-page", page === props.currentPage ? "is-active" : ""],
                onClick: () => goTo(page)
            }, String(page)))) : null,
            hasLayout("next") ? h("button", {
                type: "button",
                class: "ui-pagination-btn",
                disabled: props.currentPage >= totalPages.value,
                onClick: () => goTo(props.currentPage + 1)
            }, "下一页") : null,
            hasLayout("jumper") ? h("label", { class: "ui-pagination-jumper" }, [
                h("span", null, "跳至"),
                h("input", {
                    value: jumpValue.value,
                    inputmode: "numeric",
                    onInput: (event) => {
                        jumpValue.value = event.target.value;
                    },
                    onKeyup: (event) => {
                        if (event.key === "Enter") {
                            jumpToPage();
                        }
                    }
                }),
                h("span", null, "页")
            ]) : null
        ]);
    }
});

const ElDrawer = defineComponent({
    name: "ElDrawer",
    props: {
        modelValue: { type: Boolean, default: false },
        title: { type: String, default: "" },
        size: { type: String, default: "420px" },
        destroyOnClose: { type: Boolean, default: false }
    },
    emits: ["update:modelValue", "closed"],
    setup(props, { emit, slots }) {
        const close = () => {
            emit("update:modelValue", false);
            emit("closed");
        };

        return () => props.modelValue ? h(Teleport, { to: "body" }, [
            h("div", { class: "ui-drawer-overlay", onClick: close }),
            h("aside", {
                class: "ui-drawer",
                style: { width: props.size }
            }, [
                h("header", { class: "ui-drawer-header" }, [
                    h("h3", { class: "ui-drawer-title" }, props.title),
                    h("button", {
                        type: "button",
                        class: "ui-drawer-close",
                        "aria-label": "关闭",
                        onClick: close
                    }, "×")
                ]),
                h("div", { class: "ui-drawer-body" }, slots.default ? slots.default() : []),
                slots.footer ? h("footer", { class: "ui-drawer-footer" }, slots.footer()) : null
            ])
        ]) : null;
    }
});

const ElDialog = defineComponent({
    name: "ElDialog",
    props: {
        modelValue: { type: Boolean, default: false },
        title: { type: String, default: "" },
        width: { type: String, default: "420px" }
    },
    emits: ["update:modelValue", "closed"],
    setup(props, { emit, slots }) {
        const close = () => {
            emit("update:modelValue", false);
            emit("closed");
        };

        return () => props.modelValue ? h(Teleport, { to: "body" }, [
            h("div", { class: "ui-dialog-overlay", onClick: close }),
            h("div", {
                class: "ui-dialog",
                style: { width: props.width }
            }, [
                h("div", { class: "ui-dialog-header" }, [
                    h("h3", { class: "ui-dialog-title" }, props.title),
                    h("button", {
                        type: "button",
                        class: "ui-dialog-close",
                        "aria-label": "关闭",
                        onClick: close
                    }, "×")
                ]),
                h("div", { class: "ui-dialog-body" }, slots.default ? slots.default() : []),
                slots.footer ? h("div", { class: "ui-dialog-footer" }, slots.footer()) : null
            ])
        ]) : null;
    }
});

const ElAlert = defineComponent({
    name: "ElAlert",
    props: { title: { type: String, default: "" }, type: { type: String, default: "info" } },
    setup(props) {
        return () => h("div", { class: ["ui-alert", `ui-alert-${props.type}`] }, props.title);
    }
});

const ElCarousel = defineComponent({
    name: "ElCarousel",
    setup(_, { slots }) {
        return () => h("div", { class: "ui-carousel" }, slots.default ? slots.default() : []);
    }
});

const ElCarouselItem = defineComponent({
    name: "ElCarouselItem",
    setup(_, { slots }) {
        return () => h("div", { class: "ui-carousel-item" }, slots.default ? slots.default() : []);
    }
});

const ElUpload = defineComponent({
    name: "ElUpload",
    props: {
        accept: { type: String, default: "*" },
        httpRequest: { type: Function, default: null }
    },
    setup(props, { slots }) {
        const pickFile = () => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = props.accept;
            input.onchange = () => {
                const file = input.files?.[0];
                if (file && props.httpRequest) {
                    props.httpRequest({ file });
                }
            };
            input.click();
        };

        return () => h("button", {
            type: "button",
            class: "ui-upload",
            onClick: pickFile
        }, slots.default ? slots.default() : ["上传"]);
    }
});

const ElRow = defineComponent({
    name: "ElRow",
    props: { gutter: { type: Number, default: 0 } },
    setup(props, { slots }) {
        return () => h("div", { class: "ui-row", style: { gap: `${props.gutter}px` } }, slots.default ? slots.default() : []);
    }
});

const ElCol = defineComponent({
    name: "ElCol",
    props: { span: { type: Number, default: 24 } },
    setup(props, { slots }) {
        const width = computed(() => `${(props.span / 24) * 100}%`);
        return () => h("div", { class: "ui-col", style: { width: width.value } }, slots.default ? slots.default() : []);
    }
});

const ElRate = defineComponent({
    name: "ElRate",
    props: { modelValue: { type: Number, default: 0 }, max: { type: Number, default: 5 } },
    emits: ["update:modelValue"],
    setup(props, { emit }) {
        return () => h("div", { class: "ui-rate" }, Array.from({ length: props.max }, (_, index) => {
            const value = index + 1;
            return h("button", {
                type: "button",
                class: ["ui-rate-star", props.modelValue >= value ? "active" : ""],
                onClick: () => emit("update:modelValue", value)
            }, "★");
        }));
    }
});

export const ElementCompatPlugin = {
    install(app) {
        app.directive("loading", LoadingDirective);
        app.component("el-form", ElForm);
        app.component("el-form-item", ElFormItem);
        app.component("el-button", ElButton);
        app.component("el-icon", ElIcon);
        app.component("el-input", ElInput);
        app.component("el-select", ElSelect);
        app.component("el-option", ElOption);
        app.component("el-empty", ElEmpty);
        app.component("el-avatar", ElAvatar);
        app.component("el-tag", ElTag);
        app.component("el-table", ElTable);
        app.component("el-table-column", ElTableColumn);
        app.component("el-pagination", ElPagination);
        app.component("el-drawer", ElDrawer);
        app.component("el-dialog", ElDialog);
        app.component("el-alert", ElAlert);
        app.component("el-carousel", ElCarousel);
        app.component("el-carousel-item", ElCarouselItem);
        app.component("el-upload", ElUpload);
        app.component("el-row", ElRow);
        app.component("el-col", ElCol);
        app.component("el-rate", ElRate);
    }
};
