const { getDb, closeDb } = require("../src/config/db");
const { cleanupOrphanUploads, ensureUploadDirSync } = require("../src/utils/upload");

async function main() {
    ensureUploadDirSync();
    const db = getDb();
    const removed = await cleanupOrphanUploads(db);
    console.log(JSON.stringify({
        ok: true,
        removed_count: removed.length,
        removed
    }, null, 2));
}

main()
    .then(async () => {
        await closeDb();
        process.exit(0);
    })
    .catch(async (error) => {
        console.error(error && error.stack ? error.stack : error);
        await closeDb();
        process.exit(1);
    });
