const fs = require("fs");
const path = require("path");

function parseEnvContent(content) {
    const entries = {};
    for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) {
            continue;
        }

        const equalsIndex = line.indexOf("=");
        if (equalsIndex === -1) {
            continue;
        }

        const key = line.slice(0, equalsIndex).trim();
        if (!key) {
            continue;
        }

        let value = line.slice(equalsIndex + 1).trim();
        if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }

        if (!(key in entries)) {
            entries[key] = value;
        }
    }

    return entries;
}

function loadEnvFile(filePath) {
    if (!fs.existsSync(filePath)) {
        return;
    }

    const parsed = parseEnvContent(fs.readFileSync(filePath, "utf8"));
    for (const [key, value] of Object.entries(parsed)) {
        if (process.env[key] === undefined) {
            process.env[key] = value;
        }
    }
}

function loadAppEnv() {
    const projectRoot = path.resolve(__dirname, "..", "..", "..");
    const serverRoot = path.resolve(__dirname, "..", "..");

    loadEnvFile(path.join(projectRoot, ".env"));
    loadEnvFile(path.join(serverRoot, ".env"));
}

module.exports = { loadAppEnv };
