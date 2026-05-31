let messageRoot = null;
let noticeRoot = null;

function ensureRoot() {
    if (messageRoot) {
        return messageRoot;
    }
    messageRoot = document.createElement("div");
    messageRoot.className = "ui-toast-root";
    document.body.appendChild(messageRoot);
    return messageRoot;
}

function ensureNoticeRoot() {
    if (noticeRoot) {
        return noticeRoot;
    }
    noticeRoot = document.createElement("div");
    noticeRoot.className = "ui-notice-root";
    document.body.appendChild(noticeRoot);
    return noticeRoot;
}

function removeNotice(item) {
    if (!item || item.dataset.state === "closing") {
        return;
    }
    item.dataset.state = "closing";
    item.classList.add("is-hide");
    window.setTimeout(() => item.remove(), 220);
}

function showMessage(text, type = "info") {
    const root = ensureRoot();
    const item = document.createElement("div");
    item.className = `ui-toast ui-toast-${type}`;
    item.textContent = text || "操作完成";
    root.appendChild(item);
    window.setTimeout(() => {
        item.classList.add("is-hide");
        window.setTimeout(() => item.remove(), 200);
    }, 2200);
}

function normalizeNoticeOptions(options) {
    if (typeof options === "string") {
        return {
            title: "新通知",
            message: options,
            duration: 4200,
            onClick: null
        };
    }

    return {
        title: options?.title || "新通知",
        message: options?.message || "",
        duration: Number(options?.duration) > 0 ? Number(options.duration) : 4200,
        onClick: typeof options?.onClick === "function" ? options.onClick : null
    };
}

function showNotice(options, type = "info") {
    const root = ensureNoticeRoot();
    const normalized = normalizeNoticeOptions(options);
    const item = document.createElement("div");
    const body = document.createElement("div");
    const title = document.createElement("div");
    const message = document.createElement("div");
    const close = document.createElement("button");

    item.className = `ui-notice ui-notice-${type}`;
    item.setAttribute("role", "status");

    body.className = "ui-notice-body";
    title.className = "ui-notice-title";
    message.className = "ui-notice-message";
    close.className = "ui-notice-close";
    close.type = "button";
    close.setAttribute("aria-label", "关闭通知");

    title.textContent = normalized.title;
    message.textContent = normalized.message || "点击查看详情";
    close.textContent = "×";

    body.appendChild(title);
    body.appendChild(message);
    item.appendChild(body);
    item.appendChild(close);
    root.appendChild(item);

    if (normalized.onClick) {
        item.classList.add("is-clickable");
        item.addEventListener("click", () => {
            normalized.onClick();
            removeNotice(item);
        });
    }

    close.addEventListener("click", (event) => {
        event.stopPropagation();
        removeNotice(item);
    });

    window.setTimeout(() => removeNotice(item), normalized.duration);
}

export const ElMessage = {
    success(message) {
        showMessage(message, "success");
    },
    warning(message) {
        showMessage(message, "warning");
    },
    error(message) {
        showMessage(message, "error");
    },
    info(message) {
        showMessage(message, "info");
    }
};

export const ElNotification = {
    success(options) {
        showNotice(options, "success");
    },
    warning(options) {
        showNotice(options, "warning");
    },
    error(options) {
        showNotice(options, "error");
    },
    info(options) {
        showNotice(options, "info");
    }
};

export const ElMessageBox = {
    confirm(message, title = "提示") {
        return new Promise((resolve, reject) => {
            const ok = window.confirm(`${title}\n\n${message}`);
            if (ok) {
                resolve(true);
                return;
            }
            reject(new Error("cancel"));
        });
    }
};
