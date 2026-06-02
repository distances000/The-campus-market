require("express-async-errors");
const http = require("http");
const { loadAppEnv } = require("./config/loadEnv");
const express = require("express");
const cors = require("cors");
const { initDatabase } = require("./models/init");
const { attachRealtimeServer } = require("./utils/realtime");
const { getRuntimeConfig, validateRuntimeConfig, formatRuntimeSummary } = require("./config/runtime");
const { UPLOAD_DIR, UPLOAD_PUBLIC_PREFIX } = require("./utils/upload");
const app = express();

loadAppEnv();

const runtimeConfig = getRuntimeConfig();
const runtimeCheck = validateRuntimeConfig(runtimeConfig);

if (!runtimeCheck.valid) {
    console.error("生产/运行环境配置不完整：");
    runtimeCheck.errors.forEach((message) => console.error(`- ${message}`));
    process.exit(1);
}

const PORT = runtimeConfig.port;

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(UPLOAD_PUBLIC_PREFIX, express.static(UPLOAD_DIR));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/products", require("./routes/products"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/posts", require("./routes/posts"));
app.use("/api/messages", require("./routes/messages"));
app.use("/api/reports", require("./routes/reports"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/moderation", require("./routes/moderation"));
app.use("/api/setup", require("./routes/setup"));
app.use("/api/upload", require("./routes/upload"));

app.get("/api/health", (req, res) => res.json({ code: 200, message: "Server running", time: new Date().toISOString() }));
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ code: 500, message: "服务器内部错误" });
});

async function bootstrap() {
    await initDatabase();
    const server = http.createServer(app);
    attachRealtimeServer(server);
    console.log("Runtime config:", formatRuntimeSummary(runtimeConfig));
    server.listen(PORT, () => console.log("Server running at http://localhost:" + PORT));
}

bootstrap().catch((error) => {
    if (error && error.code === "ECONNREFUSED") {
        console.error("Failed to bootstrap server: MySQL connection refused.");
        console.error("Please start MySQL or set DATABASE_URL in server/.env or .env before running the server.");
    }
    console.error("Failed to bootstrap server:", error);
    process.exit(1);
});
