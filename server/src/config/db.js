const mysql = require("mysql2/promise");
const { loadAppEnv } = require("./loadEnv");

loadAppEnv();

let poolPromise = null;
let db = null;

function normalizeSql(sql) {
    return String(sql || "").trim().replace(/;+\s*$/, "");
}

function convertPlaceholders(sql) {
    return normalizeSql(sql);
}

function parseDatabaseUrl(databaseUrl) {
    const url = new URL(databaseUrl);
    return {
        host: url.hostname || "127.0.0.1",
        port: url.port ? Number(url.port) : 3306,
        user: decodeURIComponent(url.username || "root"),
        password: decodeURIComponent(url.password || ""),
        database: decodeURIComponent(url.pathname.replace(/^\/+/, "")),
        waitForConnections: true,
        connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
        multipleStatements: true,
        charset: "utf8mb4",
        timezone: "Z"
    };
}

function buildPoolConfig() {
    if (process.env.DATABASE_URL) {
        return parseDatabaseUrl(process.env.DATABASE_URL);
    }

    return {
        host: process.env.MYSQL_HOST || process.env.PGHOST || "127.0.0.1",
        port: Number(process.env.MYSQL_PORT || process.env.PGPORT || 3306),
        user: process.env.MYSQL_USER || process.env.PGUSER || "root",
        password: process.env.MYSQL_PASSWORD || process.env.PGPASSWORD || "",
        database: process.env.MYSQL_DATABASE || process.env.PGDATABASE || "campus_market",
        waitForConnections: true,
        connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
        multipleStatements: true,
        charset: "utf8mb4",
        timezone: "Z"
    };
}

function escapeIdentifier(identifier) {
    return "`" + String(identifier).replace(/`/g, "``") + "`";
}

async function ensureDatabaseExists(config) {
    const databaseName = config.database;
    if (!databaseName) {
        throw new Error("MySQL database name is missing. Set DATABASE_URL or MYSQL_DATABASE.");
    }

    const connection = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        multipleStatements: true,
        charset: "utf8mb4",
        timezone: "Z"
    });

    try {
        await connection.query(
            `CREATE DATABASE IF NOT EXISTS ${escapeIdentifier(databaseName)} DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
        );
    } finally {
        await connection.end();
    }
}

async function createPoolOnce() {
    if (!poolPromise) {
        const config = buildPoolConfig();
        poolPromise = (async () => {
            await ensureDatabaseExists(config);
            return mysql.createPool(config);
        })();
    }

    return poolPromise;
}

async function executeQuery(executor, sql, params = []) {
    const text = convertPlaceholders(sql);
    const [result] = await executor.query(text, params);

    if (Array.isArray(result)) {
        return {
            rows: result,
            rowCount: result.length,
            insertId: null
        };
    }

    return {
        rows: [],
        rowCount: result?.affectedRows || 0,
        insertId: result?.insertId || null
    };
}

function getExecutor() {
    return {
        async query(sql, params) {
            const pool = await createPoolOnce();
            return pool.query(sql, params);
        },
        async getConnection() {
            const pool = await createPoolOnce();
            return pool.getConnection();
        }
    };
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
                    const result = await executeQuery(executor, sql, params);
                    return {
                        changes: result.rowCount || 0,
                        lastInsertRowid: result.insertId || null
                    };
                }
            };
        },
        async exec(sql) {
            const executorWithPool = getExecutor();
            return executorWithPool.query(sql);
        },
        async transaction(callback) {
            const connection = await (await createPoolOnce()).getConnection();
            const txDb = createDb(connection);
            try {
                await connection.beginTransaction();
                const result = await callback(txDb);
                await connection.commit();
                return result;
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        }
    };
}

function getPool() {
    return createPoolOnce();
}

function getDb() {
    if (!db) {
        db = createDb(getExecutor());
    }
    return db;
}

async function closeDb() {
    if (poolPromise) {
        const pool = await poolPromise;
        await pool.end();
        poolPromise = null;
        db = null;
    }
}

module.exports = {
    getDb,
    getPool,
    closeDb,
    convertPlaceholders
};
