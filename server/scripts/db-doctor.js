const { getDb, closeDb } = require("../src/config/db");
const { inspectDatabase } = require("../src/models/init");

async function main() {
    const db = getDb();
    const report = await inspectDatabase(db);
    console.log(JSON.stringify(report, null, 2));

    if (!report.healthy) {
        process.exitCode = 1;
    }
}

main()
    .then(async () => {
        await closeDb();
    })
    .catch(async (error) => {
        console.error(error && error.stack ? error.stack : error);
        await closeDb();
        process.exit(1);
    });
