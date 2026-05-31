import {
    defineComponent,
    h,
    ref,
    computed,
    provide,
    inject,
    Teleport,
    onBeforeUnmount
} from "vue";

const FormKey = Symbol("form");

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
            items.value = items.value.filter((it) => it !== item);
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
            if (!form || !props.prop) return true;
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
            h("div", { class: "ui-dialog", style: { width: props.width } }, [
                h("div", { class: "ui-dialog-header" }, [
                    h("h3", { class: "ui-dialog-title" }, props.title),
                    h("button", { class: "ui-dialog-close", onClick: close }, "×")
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
        return () => h("div", { class: "ui-rate" }, Array.from({ length: props.max }, (_, i) => {
            const value = i + 1;
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
