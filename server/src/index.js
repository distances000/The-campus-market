const express = require("express");
const cors = require("cors");
const path = require("path");
const { initDatabase } = require("./models/init");
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
app.use("/api/upload", require("./routes/upload"));

app.get("/api/health", (req, res) => res.json({ code: 200, message: "Server running", time: new Date().toISOString() }));

initDatabase();
app.listen(PORT, () => console.log("Server running at http://localhost:" + PORT));
