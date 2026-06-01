const { getDb, closeDb } = require("../config/db");

async function ensureColumn(db, tableName, columnName, definition) {
    const existing = await db.prepare(`
        SELECT COLUMN_NAME
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND COLUMN_NAME = ?
        LIMIT 1
    `).get(tableName, columnName);

    if (!existing) {
        await db.exec(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
    }
}

async function initDatabase() {
    const db = getDb();

    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(64) NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            nickname VARCHAR(64) NOT NULL DEFAULT '',
            avatar_url VARCHAR(512) NOT NULL DEFAULT '',
            campus VARCHAR(64) NOT NULL DEFAULT '',
            bio VARCHAR(255) NOT NULL DEFAULT '',
            phone VARCHAR(32) NOT NULL DEFAULT '',
            is_admin TINYINT(1) NOT NULL DEFAULT 0,
            can_moderate TINYINT(1) NOT NULL DEFAULT 0,
            must_change_password TINYINT(1) NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_users_username (username),
            KEY idx_users_admin (is_admin),
            KEY idx_users_moderator (can_moderate)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS products (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            seller_id BIGINT UNSIGNED NOT NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            price DOUBLE NOT NULL,
            original_price DOUBLE NULL,
            category VARCHAR(32) NOT NULL DEFAULT 'other',
            \`condition\` VARCHAR(32) NOT NULL DEFAULT 'used',
            campus VARCHAR(64) NOT NULL DEFAULT '',
            images_json TEXT NOT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'active',
            views INT UNSIGNED NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_products_seller (seller_id),
            KEY idx_products_category (category),
            KEY idx_products_campus (campus),
            KEY idx_products_status (status),
            KEY idx_products_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS posts (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            author_id BIGINT UNSIGNED NOT NULL,
            content TEXT NOT NULL,
            images_json TEXT NOT NULL,
            likes_count INT UNSIGNED NOT NULL DEFAULT 0,
            comments_count INT UNSIGNED NOT NULL DEFAULT 0,
            campus VARCHAR(64) NOT NULL DEFAULT '',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_posts_author (author_id),
            KEY idx_posts_created (created_at),
            KEY idx_posts_campus (campus)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS likes (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED NOT NULL,
            post_id BIGINT UNSIGNED NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_likes_user_post (user_id, post_id),
            KEY idx_likes_post (post_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS comments (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED NOT NULL,
            post_id BIGINT UNSIGNED NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_comments_post (post_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS messages (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            sender_id BIGINT UNSIGNED NOT NULL,
            receiver_id BIGINT UNSIGNED NOT NULL,
            content TEXT NOT NULL,
            msg_type VARCHAR(32) NOT NULL DEFAULT 'chat',
            is_read TINYINT(1) NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_messages_sender (sender_id),
            KEY idx_messages_receiver (receiver_id),
            KEY idx_messages_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS notifications (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED NOT NULL,
            actor_id BIGINT UNSIGNED NULL,
            kind VARCHAR(32) NOT NULL DEFAULT 'system',
            event_type VARCHAR(64) NOT NULL DEFAULT 'system_notice',
            title VARCHAR(255) NOT NULL,
            content TEXT NOT NULL,
            object_type VARCHAR(32) NOT NULL DEFAULT '',
            object_id BIGINT UNSIGNED NULL,
            extra_json TEXT NOT NULL,
            is_read TINYINT(1) NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_notifications_user (user_id),
            KEY idx_notifications_kind (kind),
            KEY idx_notifications_user_kind_read (user_id, kind, is_read),
            KEY idx_notifications_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS favorites (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED NOT NULL,
            product_id BIGINT UNSIGNED NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_favorites_user_product (user_id, product_id),
            KEY idx_favorites_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS friends (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED NOT NULL,
            friend_id BIGINT UNSIGNED NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_friends_user_friend (user_id, friend_id),
            KEY idx_friends_user (user_id),
            KEY idx_friends_pair (user_id, friend_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS hidden_conversations (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED NOT NULL,
            peer_id BIGINT UNSIGNED NOT NULL,
            hidden_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_hidden_conversations_user_peer (user_id, peer_id),
            KEY idx_hidden_conversations_user (user_id),
            KEY idx_hidden_conversations_pair (user_id, peer_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS orders (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            product_id BIGINT UNSIGNED NOT NULL,
            buyer_id BIGINT UNSIGNED NOT NULL,
            seller_id BIGINT UNSIGNED NOT NULL,
            price_snapshot DOUBLE NOT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'pending_completion',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            completed_at DATETIME NULL,
            cancelled_at DATETIME NULL,
            KEY idx_orders_buyer (buyer_id),
            KEY idx_orders_seller (seller_id),
            KEY idx_orders_product (product_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS reviews (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            order_id BIGINT UNSIGNED NOT NULL,
            product_id BIGINT UNSIGNED NOT NULL,
            reviewer_id BIGINT UNSIGNED NOT NULL,
            reviewee_id BIGINT UNSIGNED NOT NULL,
            rating INT NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_reviews_order_reviewer (order_id, reviewer_id),
            KEY idx_reviews_reviewee (reviewee_id),
            KEY idx_reviews_product (product_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS reports (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            reporter_id BIGINT UNSIGNED NOT NULL,
            target_type VARCHAR(32) NOT NULL,
            target_id BIGINT UNSIGNED NOT NULL,
            target_owner_id BIGINT UNSIGNED NULL,
            snapshot_title VARCHAR(255) NOT NULL DEFAULT '',
            snapshot_excerpt VARCHAR(255) NOT NULL DEFAULT '',
            reason VARCHAR(32) NOT NULL,
            description TEXT NOT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'pending',
            handled_action VARCHAR(32) NOT NULL DEFAULT '',
            resolution_note TEXT NOT NULL,
            handled_by BIGINT UNSIGNED NULL,
            handled_at DATETIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_reports_status (status),
            KEY idx_reports_reporter (reporter_id),
            KEY idx_reports_target (target_type, target_id),
            KEY idx_reports_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS password_reset_requests (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED NOT NULL,
            username_snapshot VARCHAR(64) NOT NULL,
            request_phone VARCHAR(32) NOT NULL,
            reason TEXT NOT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'pending',
            resolution_note TEXT NOT NULL,
            handled_by BIGINT UNSIGNED NULL,
            handled_at DATETIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_password_reset_requests_user (user_id),
            KEY idx_password_reset_requests_status (status),
            KEY idx_password_reset_requests_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await ensureColumn(db, "users", "must_change_password", "TINYINT(1) NOT NULL DEFAULT 0");
    await ensureColumn(db, "users", "can_moderate", "TINYINT(1) NOT NULL DEFAULT 0");
    await ensureColumn(db, "password_reset_requests", "resolution_note", "TEXT NOT NULL");

    console.log("Database initialized.");
}

if (require.main === module) {
    initDatabase()
        .then(async () => {
            await closeDb();
            process.exit(0);
        })
        .catch(async (error) => {
            console.error("Database initialization failed:", error);
            await closeDb();
            process.exit(1);
        });
}

module.exports = { initDatabase };
