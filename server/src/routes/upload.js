const express = require("express");
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { authMiddleware } = require("../middleware/auth");
const router = express.Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => { fs.mkdirSync(path.join(__dirname,"..","..","uploads"),{recursive:true}); cb(null, path.join(__dirname,"..","..","uploads")); },
    filename: (req, file, cb) => { const ext = path.extname(file.originalname); cb(null, uuidv4()+ext); }
});

const upload = multer({ storage, limits: { fileSize: 10*1024*1024 }, fileFilter: (req,file,cb) => { const allowed=[".jpg",".jpeg",".png",".gif",".webp"]; if(allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null,true); else cb(new Error("???jpg/png/gif/webp")); } });

router.post("/", authMiddleware, upload.single("file"), (req, res) => {
    if (!req.file) return res.json({ code: 400, message: "?????" });
    res.json({ code: 200, data: { url: "/uploads/"+req.file.filename, filename: req.file.filename } });
});

router.post("/batch", authMiddleware, upload.array("files", 9), (req, res) => {
    if (!req.files || !req.files.length) return res.json({ code: 400, message: "?????" });
    res.json({ code: 200, data: { urls: req.files.map(f=>"/uploads/"+f.filename) } });
});

module.exports = router;