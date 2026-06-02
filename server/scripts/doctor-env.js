const { getRuntimeConfig, validateRuntimeConfig, formatRuntimeSummary } = require("../src/config/runtime");

const config = getRuntimeConfig();
const result = validateRuntimeConfig(config);

console.log(JSON.stringify({
    valid: result.valid,
    summary: formatRuntimeSummary(config),
    errors: result.errors
}, null, 4));

if (!result.valid) {
    process.exit(1);
}
