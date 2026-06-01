export const UPLOAD_LIMITS = {
    maxImageCount: 9,
    maxImageSizeBytes: 5 * 1024 * 1024,
    allowedExtensions: [".jpg", ".jpeg", ".png", ".gif", ".webp"],
    allowedMimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"]
};

export function formatUploadSize(bytes) {
    if (!bytes) {
        return "0MB";
    }
    return `${(bytes / 1024 / 1024).toFixed(bytes % (1024 * 1024) === 0 ? 0 : 1)}MB`;
}

export function validateImageFile(file, currentCount) {
    if (!file) {
        return "请选择要上传的图片";
    }

    if (currentCount >= UPLOAD_LIMITS.maxImageCount) {
        return `最多上传 ${UPLOAD_LIMITS.maxImageCount} 张图片`;
    }

    const name = String(file.name || "");
    const extension = name.includes(".") ? `.${name.split(".").pop().toLowerCase()}` : "";
    const mimeType = String(file.type || "").toLowerCase();

    if (
        !UPLOAD_LIMITS.allowedExtensions.includes(extension) ||
        !UPLOAD_LIMITS.allowedMimeTypes.includes(mimeType)
    ) {
        return "仅支持 JPG、JPEG、PNG、GIF、WebP 图片";
    }

    if (Number(file.size || 0) > UPLOAD_LIMITS.maxImageSizeBytes) {
        return `单张图片不能超过 ${formatUploadSize(UPLOAD_LIMITS.maxImageSizeBytes)}`;
    }

    return "";
}
