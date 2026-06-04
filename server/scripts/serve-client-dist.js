const fs = require("fs");
const http = require("http");
const path = require("path");

const clientDistDir = path.resolve(__dirname, "..", "..", "client", "dist");
const host = process.env.SMOKE_PAGE_HOST || "127.0.0.1";
const port = Number(process.env.SMOKE_PAGE_PORT || 4173);

const contentTypes = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".txt": "text/plain; charset=utf-8",
    ".webp": "image/webp"
};

function contentTypeFor(filePath) {
    return contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function resolveStaticPath(requestPath) {
    const decodedPath = decodeURIComponent(requestPath);
    const normalizedPath = path.normalize(decodedPath).replace(/^([.]{2}[\\/])+/, "");
    const absolutePath = path.join(clientDistDir, normalizedPath);
    if (!absolutePath.startsWith(clientDistDir)) {
        return null;
    }
    return absolutePath;
}

function sendFile(res, filePath) {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, {
        "Content-Type": contentTypeFor(filePath),
        "Cache-Control": filePath.endsWith("index.html") ? "no-cache" : "public, max-age=31536000, immutable"
    });
    res.end(data);
}

const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url || "/", `http://${host}:${port}`);
    const pathname = requestUrl.pathname || "/";

    if (pathname === "/nginx-health") {
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("ok");
        return;
    }

    const staticPath = resolveStaticPath(pathname);
    if (staticPath && fs.existsSync(staticPath) && fs.statSync(staticPath).isFile()) {
        sendFile(res, staticPath);
        return;
    }

    const fallback = path.join(clientDistDir, "index.html");
    if (fs.existsSync(fallback)) {
        sendFile(res, fallback);
        return;
    }

    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("dist not found");
});

server.listen(port, host, () => {
    console.log(`静态页面服务已启动: http://${host}:${port}`);
});

process.on("SIGINT", () => {
    server.close(() => process.exit(130));
});

process.on("SIGTERM", () => {
    server.close(() => process.exit(143));
});
