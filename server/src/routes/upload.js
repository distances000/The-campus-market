const express = require("express");
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { authMiddleware } = require("../middleware/auth");
const {
    MAX_IMAGE_SIZE_BYTES,
    MAX_IMAGE_COUNT,
    ALLOWED_IMAGE_EXTENSIONS,
    ALLOWED_IMAGE_MIME_TYPES,
    ensureUploadDirSync,
    buildUploadUrl,
    UPLOAD_DIR
} = require("../utils/upload");
const { buildRequestMeta, logInfo, logWarn } = require("../utils/logger");

const router = express.Router();

ensureUploadDirSync();

function createUploadError(message, code = "UPLOAD_ERROR") {
    const error = new Error(message);
    error.code = code;
    error.isUploadError = true;
    return error;
}

function validateIncomingFile(file) {
    const extension = path.extname(file.originalname || "").toLowerCase();
    const mimeType = String(file.mimetype || "").toLowerCase();

    if (!ALLOWED_IMAGE_EXTENSIONS.includes(extension) || !ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)) {
        throw createUploadError("仅支持 JPG、JPEG、PNG、GIF、WebP 图片");
    }

    return extension;
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        try {
            const extension = validateIncomingFile(file);
            cb(null, `${uuidv4()}${extension}`);
        } catch (error) {
            cb(error);
        }
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: MAX_IMAGE_SIZE_BYTES,
        files: MAX_IMAGE_COUNT
    },
    fileFilter: (req, file, cb) => {
        try {
            validateIncomingFile(file);
            cb(null, true);
        } catch (error) {
            cb(error);
        }
    }
});

function withUpload(middleware) {
    return (req, res, next) => {
        middleware(req, res, (error) => {
            if (error) {
                next(error);
                return;
            }
            next();
        });
    };
}

router.post("/", authMiddleware, withUpload(upload.single("file")), (req, res) => {
    if (!req.file) {
        return res.json({ code: 400, message: "请选择要上传的图片" });
    }

    logInfo("upload.single_succeeded", "单图上传成功", buildRequestMeta(req, {
        filename: req.file.filename,
        size: req.file.size
    }));

    return res.json({
        code: 200,
        message: "图片上传成功",
        data: {
            url: buildUploadUrl(req.file.filename),
            filename: req.file.filename,
            limits: {
                max_size_bytes: MAX_IMAGE_SIZE_BYTES,
                max_count: MAX_IMAGE_COUNT,
                allowed_extensions: ALLOWED_IMAGE_EXTENSIONS
            }
        }
    });
});

router.post("/batch", authMiddleware, withUpload(upload.array("files", MAX_IMAGE_COUNT)), (req, res) => {
    if (!req.files || !req.files.length) {
        return res.json({ code: 400, message: "请选择要上传的图片" });
    }

    logInfo("upload.batch_succeeded", "批量图片上传成功", buildRequestMeta(req, {
        file_count: req.files.length,
        filenames: req.files.map((file) => file.filename)
    }));

    return res.json({
        code: 200,
        message: "图片上传成功",
        data: {
            urls: req.files.map((file) => buildUploadUrl(file.filename)),
            files: req.files.map((file) => ({
                url: buildUploadUrl(file.filename),
                filename: file.filename
            })),
            limits: {
                max_size_bytes: MAX_IMAGE_SIZE_BYTES,
                max_count: MAX_IMAGE_COUNT,
                allowed_extensions: ALLOWED_IMAGE_EXTENSIONS
            }
        }
    });
});

router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
            logWarn("upload.rejected", "图片上传失败：文件过大", buildRequestMeta(req, {
                multer_code: error.code
            }));
            return res.status(400).json({
                code: 400,
                message: `单张图片不能超过 ${Math.floor(MAX_IMAGE_SIZE_BYTES / (1024 * 1024))}MB`
            });
        }

        if (error.code === "LIMIT_FILE_COUNT" || error.code === "LIMIT_UNEXPECTED_FILE") {
            logWarn("upload.rejected", "图片上传失败：数量超限", buildRequestMeta(req, {
                multer_code: error.code
            }));
            return res.status(400).json({
                code: 400,
                message: `一次最多上传 ${MAX_IMAGE_COUNT} 张图片`
            });
        }
    }

    if (error?.isUploadError) {
        logWarn("upload.rejected", "图片上传失败：格式不支持或请求无效", buildRequestMeta(req, {
            upload_error_code: error.code,
            reason: error.message
        }));
        return res.status(400).json({
            code: 400,
            message: error.message || "图片上传失败"
        });
    }

    return next(error);
});

module.exports = router;
