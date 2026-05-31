let messageRoot = null;

function ensureRoot() {
    if (messageRoot) {
        return messageRoot;
    }
    messageRoot = document.createElement("div");
    messageRoot.className = "ui-toast-root";
    document.body.appendChild(messageRoot);
    return messageRoot;
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
