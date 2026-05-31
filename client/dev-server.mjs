import { createServer } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const server = await createServer({
    configFile: false,
    plugins: [vue()],
    resolve: {
        alias: { "@": path.resolve(__dirname, "src") }
    },
    server: {
        host: "0.0.0.0",
        port: 5173,
        fs: { strict: false },
        proxy: {
            "/api": { target: "http://localhost:3000", changeOrigin: true },
            "/ws": { target: "ws://localhost:3000", ws: true, changeOrigin: true },
            "/uploads": { target: "http://localhost:3000", changeOrigin: true }
        }
    }
});

await server.listen();
server.printUrls();
