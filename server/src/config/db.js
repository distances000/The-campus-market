const { Pool, types } = require("pg");

types.setTypeParser(20, (value) => Number(value));
types.setTypeParser(1700, (value) => Number(value));

let pool = null;
let db = null;

function convertPlaceholders(sql) {
    let result = "";
    let index = 1;
    let singleQuoted = false;
    let doubleQuoted = false;

    for (let cursor = 0; cursor < sql.length; cursor += 1) {
        const char = sql[cursor];
        const next = sql[cursor + 1];

        if (char === "'" && !doubleQuoted) {
            result += char;
            if (singleQuoted && next === "'") {
                result += next;
                cursor += 1;
                continue;
            }
            singleQuoted = !singleQuoted;
            continue;
        }

        if (char === "\"" && !singleQuoted) {
            doubleQuoted = !doubleQuoted;
            result += char;
            continue;
        }

        if (char === "?" && !singleQuoted && !doubleQuoted) {
            result += `$${index}`;
            index += 1;
            continue;
        }

        result += char;
    }

    return result;
}

function normalizeSql(sql) {
    return String(sql || "").trim().replace(/;+\s*$/, "");
}

function detectWriteType(sql) {
    const normalized = normalizeSql(sql).toUpperCase();
    if (normalized.startsWith("INSERT")) {
        return "insert";
    }
    if (normalized.startsWith("UPDATE")) {
        return "update";
    }
    if (normalized.startsWith("DELETE")) {
        return "delete";
    }
    return "other";
}

function appendReturningId(sql) {
    const normalized = normalizeSql(sql);
    if (!normalized) {
        return normalized;
    }
    if (/\bRETURNING\b/i.test(normalized)) {
        return normalized;
    }
    return `${normalized} RETURNING id`;
}

function buildPoolConfig() {
    if (process.env.DATABASE_URL) {
        return {
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined
        };
    }

    return {
        host: process.env.PGHOST || "127.0.0.1",
        port: Number(process.env.PGPORT || 5432),
        user: process.env.PGUSER || "postgres",
        password: process.env.PGPASSWORD || "postgres",
        database: process.env.PGDATABASE || "campus_market",
        ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined
    };
}

async function executeQuery(executor, sql, params = []) {
    const text = convertPlaceholders(sql);
    return executor.query(text, params);
}

function createDb(executor) {
    return {
        prepare(sql) {
            return {
                async get(...params) {
                    const result = await executeQuery(executor, sql, params);
                    return result.rows[0] || undefined;
                },
                async all(...params) {
                    const result = await executeQuery(executor, sql, params);
                    return result.rows;
                },
                async run(...params) {
                    const writeType = detectWriteType(sql);
                    const statement = writeType === "insert" ? appendReturningId(sql) : normalizeSql(sql);
                    const result = await executeQuery(executor, statement, params);
                    return {
                        changes: result.rowCount || 0,
                        lastInsertRowid: result.rows[0]?.id || null
                    };
                }
            };
        },
        async exec(sql) {
            return executor.query(sql);
        },
        async transaction(callback) {
            const client = await pool.connect();
            const txDb = createDb(client);
            try {
                await client.query("BEGIN");
                const result = await callback(txDb);
                await client.query("COMMIT");
                return result;
            } catch (error) {
                await client.query("ROLLBACK");
                throw error;
            } finally {
                client.release();
            }
        }
    };
}

function getPool() {
    if (!pool) {
        pool = new Pool(buildPoolConfig());
    }
    return pool;
}

function getDb() {
    if (!db) {
        db = createDb(getPool());
    }
    return db;
}

async function closeDb() {
    if (pool) {
        await pool.end();
        pool = null;
        db = null;
    }
}

module.exports = {
    getDb,
    getPool,
    closeDb,
    convertPlaceholders
};
