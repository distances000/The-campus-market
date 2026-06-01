const { getDb, closeDb } = require("../config/db");

const TABLE_DEFINITIONS = [
    `
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    `
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    `
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    `
        CREATE TABLE IF NOT EXISTS likes (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED NOT NULL,
            post_id BIGINT UNSIGNED NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_likes_user_post (user_id, post_id),
            KEY idx_likes_post (post_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    `
        CREATE TABLE IF NOT EXISTS comments (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED NOT NULL,
            post_id BIGINT UNSIGNED NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_comments_post (post_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    `
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    `
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    `
        CREATE TABLE IF NOT EXISTS favorites (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED NOT NULL,
            product_id BIGINT UNSIGNED NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_favorites_user_product (user_id, product_id),
            KEY idx_favorites_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    `
        CREATE TABLE IF NOT EXISTS friends (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED NOT NULL,
            friend_id BIGINT UNSIGNED NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_friends_user_friend (user_id, friend_id),
            KEY idx_friends_user (user_id),
            KEY idx_friends_pair (user_id, friend_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    `
        CREATE TABLE IF NOT EXISTS hidden_conversations (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED NOT NULL,
            peer_id BIGINT UNSIGNED NOT NULL,
            hidden_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_hidden_conversations_user_peer (user_id, peer_id),
            KEY idx_hidden_conversations_user (user_id),
            KEY idx_hidden_conversations_pair (user_id, peer_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    `
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    `
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    `
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
            resolution_note TEXT NULL,
            handled_by BIGINT UNSIGNED NULL,
            handled_at DATETIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_reports_status (status),
            KEY idx_reports_reporter (reporter_id),
            KEY idx_reports_target (target_type, target_id),
            KEY idx_reports_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    `
        CREATE TABLE IF NOT EXISTS password_reset_requests (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED NOT NULL,
            username_snapshot VARCHAR(64) NOT NULL,
            request_phone VARCHAR(32) NOT NULL,
            reason TEXT NOT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'pending',
            resolution_note TEXT NULL,
            handled_by BIGINT UNSIGNED NULL,
            handled_at DATETIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_password_reset_requests_user (user_id),
            KEY idx_password_reset_requests_status (status),
            KEY idx_password_reset_requests_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `
];

async function ensureMigrationsTable(db) {
    await db.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            migration_key VARCHAR(128) NOT NULL,
            applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_schema_migrations_key (migration_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
}

async function ensureTable(db, sql) {
    await db.exec(sql);
}

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

async function ensureIndex(db, tableName, indexName, definition) {
    const existing = await db.prepare(`
        SELECT INDEX_NAME
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND INDEX_NAME = ?
        LIMIT 1
    `).get(tableName, indexName);

    if (!existing) {
        await db.exec(`ALTER TABLE \`${tableName}\` ADD ${definition}`);
    }
}

async function hasMigration(db, migrationKey) {
    const row = await db.prepare(`
        SELECT migration_key
        FROM schema_migrations
        WHERE migration_key=?
        LIMIT 1
    `).get(migrationKey);

    return !!row;
}

async function markMigrationApplied(db, migrationKey) {
    await db.prepare(`
        INSERT INTO schema_migrations (migration_key)
        VALUES (?)
        ON DUPLICATE KEY UPDATE migration_key=VALUES(migration_key)
    `).run(migrationKey);
}

const migrations = [
    {
        key: "20260602_001_base_tables",
        async run(db) {
            for (const sql of TABLE_DEFINITIONS) {
                await ensureTable(db, sql);
            }
        }
    },
    {
        key: "20260602_002_users_upgrade",
        async run(db) {
            await ensureColumn(db, "users", "phone", "VARCHAR(32) NOT NULL DEFAULT ''");
            await ensureColumn(db, "users", "is_admin", "TINYINT(1) NOT NULL DEFAULT 0");
            await ensureColumn(db, "users", "can_moderate", "TINYINT(1) NOT NULL DEFAULT 0");
            await ensureColumn(db, "users", "must_change_password", "TINYINT(1) NOT NULL DEFAULT 0");
            await ensureIndex(db, "users", "uq_users_username", "UNIQUE KEY `uq_users_username` (`username`)");
            await ensureIndex(db, "users", "idx_users_admin", "KEY `idx_users_admin` (`is_admin`)");
            await ensureIndex(db, "users", "idx_users_moderator", "KEY `idx_users_moderator` (`can_moderate`)");
        }
    },
    {
        key: "20260602_003_products_upgrade",
        async run(db) {
            await ensureColumn(db, "products", "original_price", "DOUBLE NULL");
            await ensureColumn(db, "products", "category", "VARCHAR(32) NOT NULL DEFAULT 'other'");
            await ensureColumn(db, "products", "condition", "VARCHAR(32) NOT NULL DEFAULT 'used'");
            await ensureColumn(db, "products", "campus", "VARCHAR(64) NOT NULL DEFAULT ''");
            await ensureColumn(db, "products", "images_json", "TEXT NOT NULL");
            await ensureColumn(db, "products", "status", "VARCHAR(32) NOT NULL DEFAULT 'active'");
            await ensureColumn(db, "products", "views", "INT UNSIGNED NOT NULL DEFAULT 0");
            await ensureIndex(db, "products", "idx_products_seller", "KEY `idx_products_seller` (`seller_id`)");
            await ensureIndex(db, "products", "idx_products_category", "KEY `idx_products_category` (`category`)");
            await ensureIndex(db, "products", "idx_products_campus", "KEY `idx_products_campus` (`campus`)");
            await ensureIndex(db, "products", "idx_products_status", "KEY `idx_products_status` (`status`)");
            await ensureIndex(db, "products", "idx_products_created", "KEY `idx_products_created` (`created_at`)");
        }
    },
    {
        key: "20260602_004_posts_social_upgrade",
        async run(db) {
            await ensureColumn(db, "posts", "images_json", "TEXT NOT NULL");
            await ensureColumn(db, "posts", "likes_count", "INT UNSIGNED NOT NULL DEFAULT 0");
            await ensureColumn(db, "posts", "comments_count", "INT UNSIGNED NOT NULL DEFAULT 0");
            await ensureColumn(db, "posts", "campus", "VARCHAR(64) NOT NULL DEFAULT ''");
            await ensureIndex(db, "posts", "idx_posts_author", "KEY `idx_posts_author` (`author_id`)");
            await ensureIndex(db, "posts", "idx_posts_created", "KEY `idx_posts_created` (`created_at`)");
            await ensureIndex(db, "posts", "idx_posts_campus", "KEY `idx_posts_campus` (`campus`)");
            await ensureIndex(db, "likes", "uq_likes_user_post", "UNIQUE KEY `uq_likes_user_post` (`user_id`, `post_id`)");
            await ensureIndex(db, "likes", "idx_likes_post", "KEY `idx_likes_post` (`post_id`)");
            await ensureIndex(db, "comments", "idx_comments_post", "KEY `idx_comments_post` (`post_id`)");
        }
    },
    {
        key: "20260602_005_message_and_notification_upgrade",
        async run(db) {
            await ensureColumn(db, "messages", "msg_type", "VARCHAR(32) NOT NULL DEFAULT 'chat'");
            await ensureColumn(db, "messages", "is_read", "TINYINT(1) NOT NULL DEFAULT 0");
            await ensureIndex(db, "messages", "idx_messages_sender", "KEY `idx_messages_sender` (`sender_id`)");
            await ensureIndex(db, "messages", "idx_messages_receiver", "KEY `idx_messages_receiver` (`receiver_id`)");
            await ensureIndex(db, "messages", "idx_messages_created", "KEY `idx_messages_created` (`created_at`)");

            await ensureColumn(db, "notifications", "actor_id", "BIGINT UNSIGNED NULL");
            await ensureColumn(db, "notifications", "kind", "VARCHAR(32) NOT NULL DEFAULT 'system'");
            await ensureColumn(db, "notifications", "event_type", "VARCHAR(64) NOT NULL DEFAULT 'system_notice'");
            await ensureColumn(db, "notifications", "title", "VARCHAR(255) NOT NULL DEFAULT ''");
            await ensureColumn(db, "notifications", "content", "TEXT NOT NULL");
            await ensureColumn(db, "notifications", "object_type", "VARCHAR(32) NOT NULL DEFAULT ''");
            await ensureColumn(db, "notifications", "object_id", "BIGINT UNSIGNED NULL");
            await ensureColumn(db, "notifications", "extra_json", "TEXT NOT NULL");
            await ensureColumn(db, "notifications", "is_read", "TINYINT(1) NOT NULL DEFAULT 0");
            await ensureIndex(db, "notifications", "idx_notifications_user", "KEY `idx_notifications_user` (`user_id`)");
            await ensureIndex(db, "notifications", "idx_notifications_kind", "KEY `idx_notifications_kind` (`kind`)");
            await ensureIndex(
                db,
                "notifications",
                "idx_notifications_user_kind_read",
                "KEY `idx_notifications_user_kind_read` (`user_id`, `kind`, `is_read`)"
            );
            await ensureIndex(db, "notifications", "idx_notifications_created", "KEY `idx_notifications_created` (`created_at`)");
        }
    },
    {
        key: "20260602_006_relation_upgrade",
        async run(db) {
            await ensureIndex(db, "favorites", "uq_favorites_user_product", "UNIQUE KEY `uq_favorites_user_product` (`user_id`, `product_id`)");
            await ensureIndex(db, "favorites", "idx_favorites_user", "KEY `idx_favorites_user` (`user_id`)");
            await ensureIndex(db, "friends", "uq_friends_user_friend", "UNIQUE KEY `uq_friends_user_friend` (`user_id`, `friend_id`)");
            await ensureIndex(db, "friends", "idx_friends_user", "KEY `idx_friends_user` (`user_id`)");
            await ensureIndex(db, "friends", "idx_friends_pair", "KEY `idx_friends_pair` (`user_id`, `friend_id`)");
            await ensureIndex(
                db,
                "hidden_conversations",
                "uq_hidden_conversations_user_peer",
                "UNIQUE KEY `uq_hidden_conversations_user_peer` (`user_id`, `peer_id`)"
            );
            await ensureIndex(db, "hidden_conversations", "idx_hidden_conversations_user", "KEY `idx_hidden_conversations_user` (`user_id`)");
            await ensureIndex(db, "hidden_conversations", "idx_hidden_conversations_pair", "KEY `idx_hidden_conversations_pair` (`user_id`, `peer_id`)");
        }
    },
    {
        key: "20260602_007_order_review_upgrade",
        async run(db) {
            await ensureColumn(db, "orders", "completed_at", "DATETIME NULL");
            await ensureColumn(db, "orders", "cancelled_at", "DATETIME NULL");
            await ensureIndex(db, "orders", "idx_orders_buyer", "KEY `idx_orders_buyer` (`buyer_id`)");
            await ensureIndex(db, "orders", "idx_orders_seller", "KEY `idx_orders_seller` (`seller_id`)");
            await ensureIndex(db, "orders", "idx_orders_product", "KEY `idx_orders_product` (`product_id`)");

            await ensureIndex(db, "reviews", "uq_reviews_order_reviewer", "UNIQUE KEY `uq_reviews_order_reviewer` (`order_id`, `reviewer_id`)");
            await ensureIndex(db, "reviews", "idx_reviews_reviewee", "KEY `idx_reviews_reviewee` (`reviewee_id`)");
            await ensureIndex(db, "reviews", "idx_reviews_product", "KEY `idx_reviews_product` (`product_id`)");
        }
    },
    {
        key: "20260602_008_report_and_reset_upgrade",
        async run(db) {
            await ensureColumn(db, "reports", "target_owner_id", "BIGINT UNSIGNED NULL");
            await ensureColumn(db, "reports", "snapshot_title", "VARCHAR(255) NOT NULL DEFAULT ''");
            await ensureColumn(db, "reports", "snapshot_excerpt", "VARCHAR(255) NOT NULL DEFAULT ''");
            await ensureColumn(db, "reports", "handled_action", "VARCHAR(32) NOT NULL DEFAULT ''");
            await ensureColumn(db, "reports", "resolution_note", "TEXT NULL");
            await ensureColumn(db, "reports", "handled_by", "BIGINT UNSIGNED NULL");
            await ensureColumn(db, "reports", "handled_at", "DATETIME NULL");
            await ensureColumn(db, "reports", "updated_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
            await ensureIndex(db, "reports", "idx_reports_status", "KEY `idx_reports_status` (`status`)");
            await ensureIndex(db, "reports", "idx_reports_reporter", "KEY `idx_reports_reporter` (`reporter_id`)");
            await ensureIndex(db, "reports", "idx_reports_target", "KEY `idx_reports_target` (`target_type`, `target_id`)");
            await ensureIndex(db, "reports", "idx_reports_created", "KEY `idx_reports_created` (`created_at`)");

            await ensureColumn(db, "password_reset_requests", "resolution_note", "TEXT NULL");
            await ensureColumn(db, "password_reset_requests", "handled_by", "BIGINT UNSIGNED NULL");
            await ensureColumn(db, "password_reset_requests", "handled_at", "DATETIME NULL");
            await ensureColumn(
                db,
                "password_reset_requests",
                "updated_at",
                "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
            );
            await ensureIndex(db, "password_reset_requests", "idx_password_reset_requests_user", "KEY `idx_password_reset_requests_user` (`user_id`)");
            await ensureIndex(
                db,
                "password_reset_requests",
                "idx_password_reset_requests_status",
                "KEY `idx_password_reset_requests_status` (`status`)"
            );
            await ensureIndex(
                db,
                "password_reset_requests",
                "idx_password_reset_requests_created",
                "KEY `idx_password_reset_requests_created` (`created_at`)"
            );
        }
    }
];

async function runMigrations(db) {
    await ensureMigrationsTable(db);

    for (const migration of migrations) {
        if (await hasMigration(db, migration.key)) {
            continue;
        }

        await migration.run(db);
        await markMigrationApplied(db, migration.key);
        console.log(`Applied migration: ${migration.key}`);
    }
}

async function initDatabase() {
    const db = getDb();
    await runMigrations(db);
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

module.exports = {
    initDatabase,
    ensureColumn,
    ensureIndex
};
