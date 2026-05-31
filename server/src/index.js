require("express-async-errors");
const http = require("http");
const express = require("express");
const cors = require("cors");
const path = require("path");
const { initDatabase } = require("./models/init");
const { attachRealtimeServer } = require("./utils/realtime");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/products", require("./routes/products"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/posts", require("./routes/posts"));
app.use("/api/messages", require("./routes/messages"));
app.use("/api/reports", require("./routes/reports"));
app.use("/api/admin", require("./routes/admin"));
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
    server.listen(PORT, () => console.log("Server running at http://localhost:" + PORT));
}

bootstrap().catch((error) => {
    console.error("Failed to bootstrap server:", error);
    process.exit(1);
});
