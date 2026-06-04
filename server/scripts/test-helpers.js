const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");
const { getDatabaseUrl } = require("./shared");

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function expectCode(result, expectedCode, step) {
    assert(result && result.data && result.data.code === expectedCode, `${step} failed: ${JSON.stringify(result && result.data)}`);
}

function logStep(step, detail) {
    console.log(`[${step}] ${detail}`);
}

async function createDbConnection() {
    return mysql.createConnection(getDatabaseUrl());
}

async function cleanupUsers(usernames) {
    const db = await createDbConnection();
    try {
        const placeholders = usernames.map(() => "?").join(",");
        const [rows] = await db.query(`SELECT id FROM users WHERE username IN (${placeholders})`, usernames);
        const userIds = rows.map((row) => row.id);
        if (!userIds.length) {
            return;
        }

        const idPlaceholders = userIds.map(() => "?").join(",");
        await db.beginTransaction();
        await db.query(`DELETE FROM notifications WHERE user_id IN (${idPlaceholders}) OR actor_id IN (${idPlaceholders})`, [...userIds, ...userIds]);
        await db.query(`DELETE FROM password_reset_requests WHERE user_id IN (${idPlaceholders}) OR handled_by IN (${idPlaceholders})`, [...userIds, ...userIds]);
        await db.query(`DELETE FROM hidden_conversations WHERE user_id IN (${idPlaceholders}) OR peer_id IN (${idPlaceholders})`, [...userIds, ...userIds]);
        await db.query(`DELETE FROM friends WHERE user_id IN (${idPlaceholders}) OR friend_id IN (${idPlaceholders})`, [...userIds, ...userIds]);
        await db.query(`DELETE FROM favorites WHERE user_id IN (${idPlaceholders})`, userIds);
        await db.query(`DELETE FROM likes WHERE user_id IN (${idPlaceholders})`, userIds);
        await db.query(`DELETE FROM comments WHERE user_id IN (${idPlaceholders})`, userIds);
        await db.query(`DELETE FROM messages WHERE sender_id IN (${idPlaceholders}) OR receiver_id IN (${idPlaceholders})`, [...userIds, ...userIds]);
        await db.query(`DELETE FROM reviews WHERE reviewer_id IN (${idPlaceholders}) OR reviewee_id IN (${idPlaceholders})`, [...userIds, ...userIds]);
        await db.query(`DELETE FROM orders WHERE buyer_id IN (${idPlaceholders}) OR seller_id IN (${idPlaceholders})`, [...userIds, ...userIds]);
        await db.query(`DELETE FROM reports WHERE reporter_id IN (${idPlaceholders}) OR target_owner_id IN (${idPlaceholders}) OR handled_by IN (${idPlaceholders})`, [...userIds, ...userIds, ...userIds]);
        await db.query(`DELETE FROM posts WHERE author_id IN (${idPlaceholders})`, userIds);
        await db.query(`DELETE FROM products WHERE seller_id IN (${idPlaceholders})`, userIds);
        await db.query(`DELETE FROM users WHERE id IN (${idPlaceholders})`, userIds);
        await db.commit();
    } catch (error) {
        await db.rollback();
        throw error;
    } finally {
        await db.end();
    }
}

async function createAdminUser(user) {
    const db = await createDbConnection();
    try {
        const passwordHash = bcrypt.hashSync(user.password, 10);
        await db.query("DELETE FROM users WHERE username=?", [user.username]);
        await db.query(`
            INSERT INTO users (username, password_hash, nickname, email, is_admin, can_moderate)
            VALUES (?, ?, ?, ?, 1, 1)
        `, [user.username, passwordHash, user.nickname, user.email]);
    } finally {
        await db.end();
    }
}

module.exports = {
    assert,
    expectCode,
    logStep,
    createDbConnection,
    cleanupUsers,
    createAdminUser
};
