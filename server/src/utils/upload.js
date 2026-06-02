const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const { getRuntimeConfig } = require("../config/runtime");

const runtimeConfig = getRuntimeConfig();
const UPLOAD_DIR = runtimeConfig.uploadDir;
const UPLOAD_PUBLIC_PREFIX = `${runtimeConfig.uploadPublicPrefix}/`;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_COUNT = 9;
const ALLOWED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
const ALLOWED_IMAGE_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp"
];

function ensureUploadDirSync() {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function buildUploadUrl(filename) {
    return `${UPLOAD_PUBLIC_PREFIX}${filename}`;
}

function isManagedUploadUrl(url) {
    return typeof url === "string" && url.startsWith(UPLOAD_PUBLIC_PREFIX);
}

function extractManagedUploadFilename(url) {
    if (!isManagedUploadUrl(url)) {
        return "";
    }

    const filename = path.basename(String(url).slice(UPLOAD_PUBLIC_PREFIX.length));
    if (!filename || filename === "." || filename === "..") {
        return "";
    }

    return filename;
}

function resolveManagedUploadPath(filename) {
    const safeFilename = path.basename(String(filename || ""));
    if (!safeFilename || safeFilename === "." || safeFilename === "..") {
        return "";
    }
    return path.join(UPLOAD_DIR, safeFilename);
}

function normalizeImageList(value) {
    let parsed = value;

    if (typeof value === "string") {
        try {
            parsed = JSON.parse(value);
        } catch {
            throw new Error("图片数据格式不正确");
        }
    }

    if (parsed === undefined || parsed === null || parsed === "") {
        return [];
    }

    if (!Array.isArray(parsed)) {
        throw new Error("图片数据格式不正确");
    }

    const list = parsed
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean);

    if (list.length > MAX_IMAGE_COUNT) {
        throw new Error(`最多上传 ${MAX_IMAGE_COUNT} 张图片`);
    }

    return list;
}

function getRemovedManagedUrls(previousUrls, nextUrls) {
    const nextSet = new Set((nextUrls || []).filter(Boolean));
    return (previousUrls || []).filter((url) => isManagedUploadUrl(url) && !nextSet.has(url));
}

async function collectReferencedUploadFilenames(db) {
    const referenced = new Set();

    const productRows = await db.prepare("SELECT images_json FROM products").all();
    const postRows = await db.prepare("SELECT images_json FROM posts").all();
    const userRows = await db.prepare("SELECT avatar_url FROM users WHERE avatar_url <> ''").all();

    for (const row of productRows) {
        let urls = [];
        try {
            urls = normalizeImageList(row.images_json);
        } catch {
            urls = [];
        }
        for (const url of urls) {
            const filename = extractManagedUploadFilename(url);
            if (filename) {
                referenced.add(filename);
            }
        }
    }

    for (const row of postRows) {
        let urls = [];
        try {
            urls = normalizeImageList(row.images_json);
        } catch {
            urls = [];
        }
        for (const url of urls) {
            const filename = extractManagedUploadFilename(url);
            if (filename) {
                referenced.add(filename);
            }
        }
    }

    for (const row of userRows) {
        const filename = extractManagedUploadFilename(row.avatar_url);
        if (filename) {
            referenced.add(filename);
        }
    }

    return referenced;
}

async function deleteManagedUploadsIfOrphan(db, urls) {
    const filenames = [...new Set((urls || []).map(extractManagedUploadFilename).filter(Boolean))];
    if (!filenames.length) {
        return [];
    }

    const referenced = await collectReferencedUploadFilenames(db);
    const removed = [];

    for (const filename of filenames) {
        if (referenced.has(filename)) {
            continue;
        }

        const filePath = resolveManagedUploadPath(filename);
        if (!filePath) {
            continue;
        }

        try {
            await fsp.unlink(filePath);
            removed.push(filename);
        } catch (error) {
            if (error.code !== "ENOENT") {
                throw error;
            }
        }
    }

    return removed;
}

async function cleanupOrphanUploads(db) {
    ensureUploadDirSync();
    const referenced = await collectReferencedUploadFilenames(db);
    const names = await fsp.readdir(UPLOAD_DIR, { withFileTypes: true });
    const removed = [];

    for (const entry of names) {
        if (!entry.isFile()) {
            continue;
        }

        if (referenced.has(entry.name)) {
            continue;
        }

        const filePath = resolveManagedUploadPath(entry.name);
        if (!filePath) {
            continue;
        }

        await fsp.unlink(filePath);
        removed.push(entry.name);
    }

    return removed;
}

module.exports = {
    UPLOAD_DIR,
    UPLOAD_PUBLIC_PREFIX,
    MAX_IMAGE_SIZE_BYTES,
    MAX_IMAGE_COUNT,
    ALLOWED_IMAGE_EXTENSIONS,
    ALLOWED_IMAGE_MIME_TYPES,
    ensureUploadDirSync,
    buildUploadUrl,
    isManagedUploadUrl,
    extractManagedUploadFilename,
    resolveManagedUploadPath,
    normalizeImageList,
    getRemovedManagedUrls,
    deleteManagedUploadsIfOrphan,
    cleanupOrphanUploads
};
