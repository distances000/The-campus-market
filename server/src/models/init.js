const { getDb, closeDb } = require("../config/db");

const BASE_TABLES = [
    {
        name: "users",
        sql: `
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
        `
    },
    {
        name: "products",
        sql: `
            CREATE TABLE IF NOT EXISTS products (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                seller_id BIGINT UNSIGNED NOT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                price DOUBLE NOT NULL,
                original_price DOUBLE NULL,
                \`condition\` VARCHAR(32) NOT NULL DEFAULT 'used',
                category VARCHAR(32) NOT NULL DEFAULT 'other',
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
        `
    },
    {
        name: "posts",
        sql: `
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
        `
    },
    {
        name: "likes",
        sql: `
            CREATE TABLE IF NOT EXISTS likes (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT UNSIGNED NOT NULL,
                post_id BIGINT UNSIGNED NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_likes_user_post (user_id, post_id),
                KEY idx_likes_post (post_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `
    },
    {
        name: "comments",
        sql: `
            CREATE TABLE IF NOT EXISTS comments (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT UNSIGNED NOT NULL,
                post_id BIGINT UNSIGNED NOT NULL,
                content TEXT NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                KEY idx_comments_post (post_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `
    },
    {
        name: "messages",
        sql: `
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
        `
    },
    {
        name: "notifications",
        sql: `
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
        `
    },
    {
        name: "favorites",
        sql: `
            CREATE TABLE IF NOT EXISTS favorites (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT UNSIGNED NOT NULL,
                product_id BIGINT UNSIGNED NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_favorites_user_product (user_id, product_id),
                KEY idx_favorites_user (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `
    },
    {
        name: "friends",
        sql: `
            CREATE TABLE IF NOT EXISTS friends (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT UNSIGNED NOT NULL,
                friend_id BIGINT UNSIGNED NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_friends_user_friend (user_id, friend_id),
                KEY idx_friends_user (user_id),
                KEY idx_friends_pair (user_id, friend_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `
    },
    {
        name: "hidden_conversations",
        sql: `
            CREATE TABLE IF NOT EXISTS hidden_conversations (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT UNSIGNED NOT NULL,
                peer_id BIGINT UNSIGNED NOT NULL,
                hidden_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_hidden_conversations_user_peer (user_id, peer_id),
                KEY idx_hidden_conversations_user (user_id),
                KEY idx_hidden_conversations_pair (user_id, peer_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `
    },
    {
        name: "orders",
        sql: `
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
        `
    },
    {
        name: "reviews",
        sql: `
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
        `
    },
    {
        name: "reports",
        sql: `
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
        `
    },
    {
        name: "password_reset_requests",
        sql: `
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
    }
];

const SCHEMA_EXPECTATIONS = [
    {
        table: "schema_migrations",
        columns: ["migration_key", "applied_at"],
        indexes: ["uq_schema_migrations_key"]
    },
    {
        table: "users",
        columns: ["phone", "is_admin", "can_moderate", "must_change_password"],
        indexes: ["uq_users_username", "idx_users_admin", "idx_users_moderator"]
    },
    {
        table: "products",
        columns: ["original_price", "category", "condition", "campus", "images_json", "status", "views"],
        indexes: ["idx_products_seller", "idx_products_category", "idx_products_campus", "idx_products_status", "idx_products_created"]
    },
    {
        table: "posts",
        columns: ["images_json", "likes_count", "comments_count", "campus"],
        indexes: ["idx_posts_author", "idx_posts_created", "idx_posts_campus"]
    },
    {
        table: "likes",
        columns: ["user_id", "post_id"],
        indexes: ["uq_likes_user_post", "idx_likes_post"]
    },
    {
        table: "comments",
        columns: ["user_id", "post_id"],
        indexes: ["idx_comments_post"]
    },
    {
        table: "messages",
        columns: ["msg_type", "is_read"],
        indexes: ["idx_messages_sender", "idx_messages_receiver", "idx_messages_created"]
    },
    {
        table: "notifications",
        columns: ["actor_id", "kind", "event_type", "title", "content", "object_type", "object_id", "extra_json", "is_read"],
        indexes: ["idx_notifications_user", "idx_notifications_kind", "idx_notifications_user_kind_read", "idx_notifications_created"]
    },
    {
        table: "favorites",
        columns: ["user_id", "product_id"],
        indexes: ["uq_favorites_user_product", "idx_favorites_user"]
    },
    {
        table: "friends",
        columns: ["user_id", "friend_id"],
        indexes: ["uq_friends_user_friend", "idx_friends_user", "idx_friends_pair"]
    },
    {
        table: "hidden_conversations",
        columns: ["user_id", "peer_id", "hidden_at"],
        indexes: ["uq_hidden_conversations_user_peer", "idx_hidden_conversations_user", "idx_hidden_conversations_pair"]
    },
    {
        table: "orders",
        columns: ["completed_at", "cancelled_at"],
        indexes: ["idx_orders_buyer", "idx_orders_seller", "idx_orders_product"]
    },
    {
        table: "reviews",
        columns: ["order_id", "product_id", "reviewer_id", "reviewee_id"],
        indexes: ["uq_reviews_order_reviewer", "idx_reviews_reviewee", "idx_reviews_product"]
    },
    {
        table: "reports",
        columns: ["target_owner_id", "snapshot_title", "snapshot_excerpt", "handled_action", "resolution_note", "handled_by", "handled_at", "updated_at"],
        indexes: ["idx_reports_status", "idx_reports_reporter", "idx_reports_target", "idx_reports_created"]
    },
    {
        table: "password_reset_requests",
        columns: ["resolution_note", "handled_by", "handled_at", "updated_at"],
        indexes: ["idx_password_reset_requests_user", "idx_password_reset_requests_status", "idx_password_reset_requests_created"]
    }
];

function createMigrationContext(db) {
    const actions = [];

    return {
        actions,
        async ensureTable(tableName, sql) {
            const existed = await tableExists(db, tableName);
            if (!existed) {
                await db.exec(sql);
                actions.push(`创建表 ${tableName}`);
            }
        },
        async ensureColumn(tableName, columnName, definition) {
            const existed = await columnExists(db, tableName, columnName);
            if (!existed) {
                await db.exec(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
                actions.push(`新增列 ${tableName}.${columnName}`);
            }
        },
        async ensureIndex(tableName, indexName, definition) {
            const existed = await indexExists(db, tableName, indexName);
            if (!existed) {
                await db.exec(`ALTER TABLE \`${tableName}\` ADD ${definition}`);
                actions.push(`新增索引 ${tableName}.${indexName}`);
            }
        }
    };
}

async function tableExists(db, tableName) {
    const existing = await db.prepare(`
        SELECT TABLE_NAME
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
        LIMIT 1
    `).get(tableName);

    return !!existing;
}

async function columnExists(db, tableName, columnName) {
    const existing = await db.prepare(`
        SELECT COLUMN_NAME
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND COLUMN_NAME = ?
        LIMIT 1
    `).get(tableName, columnName);

    return !!existing;
}

async function indexExists(db, tableName, indexName) {
    const existing = await db.prepare(`
        SELECT INDEX_NAME
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND INDEX_NAME = ?
        LIMIT 1
    `).get(tableName, indexName);

    return !!existing;
}

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
        async run(ctx) {
            for (const table of BASE_TABLES) {
                await ctx.ensureTable(table.name, table.sql);
            }
        }
    },
    {
        key: "20260602_002_users_upgrade",
        async run(ctx) {
            await ctx.ensureColumn("users", "phone", "VARCHAR(32) NOT NULL DEFAULT ''");
            await ctx.ensureColumn("users", "is_admin", "TINYINT(1) NOT NULL DEFAULT 0");
            await ctx.ensureColumn("users", "can_moderate", "TINYINT(1) NOT NULL DEFAULT 0");
            await ctx.ensureColumn("users", "must_change_password", "TINYINT(1) NOT NULL DEFAULT 0");
            await ctx.ensureIndex("users", "uq_users_username", "UNIQUE KEY `uq_users_username` (`username`)");
            await ctx.ensureIndex("users", "idx_users_admin", "KEY `idx_users_admin` (`is_admin`)");
            await ctx.ensureIndex("users", "idx_users_moderator", "KEY `idx_users_moderator` (`can_moderate`)");
        }
    },
    {
        key: "20260602_003_products_upgrade",
        async run(ctx) {
            await ctx.ensureColumn("products", "original_price", "DOUBLE NULL");
            await ctx.ensureColumn("products", "condition", "VARCHAR(32) NOT NULL DEFAULT 'used'");
            await ctx.ensureColumn("products", "category", "VARCHAR(32) NOT NULL DEFAULT 'other'");
            await ctx.ensureColumn("products", "campus", "VARCHAR(64) NOT NULL DEFAULT ''");
            await ctx.ensureColumn("products", "images_json", "TEXT NOT NULL");
            await ctx.ensureColumn("products", "status", "VARCHAR(32) NOT NULL DEFAULT 'active'");
            await ctx.ensureColumn("products", "views", "INT UNSIGNED NOT NULL DEFAULT 0");
            await ctx.ensureIndex("products", "idx_products_seller", "KEY `idx_products_seller` (`seller_id`)");
            await ctx.ensureIndex("products", "idx_products_category", "KEY `idx_products_category` (`category`)");
            await ctx.ensureIndex("products", "idx_products_campus", "KEY `idx_products_campus` (`campus`)");
            await ctx.ensureIndex("products", "idx_products_status", "KEY `idx_products_status` (`status`)");
            await ctx.ensureIndex("products", "idx_products_created", "KEY `idx_products_created` (`created_at`)");
        }
    },
    {
        key: "20260602_004_posts_social_upgrade",
        async run(ctx) {
            await ctx.ensureColumn("posts", "images_json", "TEXT NOT NULL");
            await ctx.ensureColumn("posts", "likes_count", "INT UNSIGNED NOT NULL DEFAULT 0");
            await ctx.ensureColumn("posts", "comments_count", "INT UNSIGNED NOT NULL DEFAULT 0");
            await ctx.ensureColumn("posts", "campus", "VARCHAR(64) NOT NULL DEFAULT ''");
            await ctx.ensureIndex("posts", "idx_posts_author", "KEY `idx_posts_author` (`author_id`)");
            await ctx.ensureIndex("posts", "idx_posts_created", "KEY `idx_posts_created` (`created_at`)");
            await ctx.ensureIndex("posts", "idx_posts_campus", "KEY `idx_posts_campus` (`campus`)");
            await ctx.ensureIndex("likes", "uq_likes_user_post", "UNIQUE KEY `uq_likes_user_post` (`user_id`, `post_id`)");
            await ctx.ensureIndex("likes", "idx_likes_post", "KEY `idx_likes_post` (`post_id`)");
            await ctx.ensureIndex("comments", "idx_comments_post", "KEY `idx_comments_post` (`post_id`)");
        }
    },
    {
        key: "20260602_005_message_and_notification_upgrade",
        async run(ctx) {
            await ctx.ensureColumn("messages", "msg_type", "VARCHAR(32) NOT NULL DEFAULT 'chat'");
            await ctx.ensureColumn("messages", "is_read", "TINYINT(1) NOT NULL DEFAULT 0");
            await ctx.ensureIndex("messages", "idx_messages_sender", "KEY `idx_messages_sender` (`sender_id`)");
            await ctx.ensureIndex("messages", "idx_messages_receiver", "KEY `idx_messages_receiver` (`receiver_id`)");
            await ctx.ensureIndex("messages", "idx_messages_created", "KEY `idx_messages_created` (`created_at`)");

            await ctx.ensureColumn("notifications", "actor_id", "BIGINT UNSIGNED NULL");
            await ctx.ensureColumn("notifications", "kind", "VARCHAR(32) NOT NULL DEFAULT 'system'");
            await ctx.ensureColumn("notifications", "event_type", "VARCHAR(64) NOT NULL DEFAULT 'system_notice'");
            await ctx.ensureColumn("notifications", "title", "VARCHAR(255) NOT NULL DEFAULT ''");
            await ctx.ensureColumn("notifications", "content", "TEXT NOT NULL");
            await ctx.ensureColumn("notifications", "object_type", "VARCHAR(32) NOT NULL DEFAULT ''");
            await ctx.ensureColumn("notifications", "object_id", "BIGINT UNSIGNED NULL");
            await ctx.ensureColumn("notifications", "extra_json", "TEXT NOT NULL");
            await ctx.ensureColumn("notifications", "is_read", "TINYINT(1) NOT NULL DEFAULT 0");
            await ctx.ensureIndex("notifications", "idx_notifications_user", "KEY `idx_notifications_user` (`user_id`)");
            await ctx.ensureIndex("notifications", "idx_notifications_kind", "KEY `idx_notifications_kind` (`kind`)");
            await ctx.ensureIndex(
                "notifications",
                "idx_notifications_user_kind_read",
                "KEY `idx_notifications_user_kind_read` (`user_id`, `kind`, `is_read`)"
            );
            await ctx.ensureIndex("notifications", "idx_notifications_created", "KEY `idx_notifications_created` (`created_at`)");
        }
    },
    {
        key: "20260602_006_relation_upgrade",
        async run(ctx) {
            await ctx.ensureIndex("favorites", "uq_favorites_user_product", "UNIQUE KEY `uq_favorites_user_product` (`user_id`, `product_id`)");
            await ctx.ensureIndex("favorites", "idx_favorites_user", "KEY `idx_favorites_user` (`user_id`)");
            await ctx.ensureIndex("friends", "uq_friends_user_friend", "UNIQUE KEY `uq_friends_user_friend` (`user_id`, `friend_id`)");
            await ctx.ensureIndex("friends", "idx_friends_user", "KEY `idx_friends_user` (`user_id`)");
            await ctx.ensureIndex("friends", "idx_friends_pair", "KEY `idx_friends_pair` (`user_id`, `friend_id`)");
            await ctx.ensureIndex(
                "hidden_conversations",
                "uq_hidden_conversations_user_peer",
                "UNIQUE KEY `uq_hidden_conversations_user_peer` (`user_id`, `peer_id`)"
            );
            await ctx.ensureIndex("hidden_conversations", "idx_hidden_conversations_user", "KEY `idx_hidden_conversations_user` (`user_id`)");
            await ctx.ensureIndex("hidden_conversations", "idx_hidden_conversations_pair", "KEY `idx_hidden_conversations_pair` (`user_id`, `peer_id`)");
        }
    },
    {
        key: "20260602_007_order_review_upgrade",
        async run(ctx) {
            await ctx.ensureColumn("orders", "completed_at", "DATETIME NULL");
            await ctx.ensureColumn("orders", "cancelled_at", "DATETIME NULL");
            await ctx.ensureIndex("orders", "idx_orders_buyer", "KEY `idx_orders_buyer` (`buyer_id`)");
            await ctx.ensureIndex("orders", "idx_orders_seller", "KEY `idx_orders_seller` (`seller_id`)");
            await ctx.ensureIndex("orders", "idx_orders_product", "KEY `idx_orders_product` (`product_id`)");

            await ctx.ensureIndex("reviews", "uq_reviews_order_reviewer", "UNIQUE KEY `uq_reviews_order_reviewer` (`order_id`, `reviewer_id`)");
            await ctx.ensureIndex("reviews", "idx_reviews_reviewee", "KEY `idx_reviews_reviewee` (`reviewee_id`)");
            await ctx.ensureIndex("reviews", "idx_reviews_product", "KEY `idx_reviews_product` (`product_id`)");
        }
    },
    {
        key: "20260602_008_report_and_reset_upgrade",
        async run(ctx) {
            await ctx.ensureColumn("reports", "target_owner_id", "BIGINT UNSIGNED NULL");
            await ctx.ensureColumn("reports", "snapshot_title", "VARCHAR(255) NOT NULL DEFAULT ''");
            await ctx.ensureColumn("reports", "snapshot_excerpt", "VARCHAR(255) NOT NULL DEFAULT ''");
            await ctx.ensureColumn("reports", "handled_action", "VARCHAR(32) NOT NULL DEFAULT ''");
            await ctx.ensureColumn("reports", "resolution_note", "TEXT NULL");
            await ctx.ensureColumn("reports", "handled_by", "BIGINT UNSIGNED NULL");
            await ctx.ensureColumn("reports", "handled_at", "DATETIME NULL");
            await ctx.ensureColumn("reports", "updated_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
            await ctx.ensureIndex("reports", "idx_reports_status", "KEY `idx_reports_status` (`status`)");
            await ctx.ensureIndex("reports", "idx_reports_reporter", "KEY `idx_reports_reporter` (`reporter_id`)");
            await ctx.ensureIndex("reports", "idx_reports_target", "KEY `idx_reports_target` (`target_type`, `target_id`)");
            await ctx.ensureIndex("reports", "idx_reports_created", "KEY `idx_reports_created` (`created_at`)");

            await ctx.ensureColumn("password_reset_requests", "resolution_note", "TEXT NULL");
            await ctx.ensureColumn("password_reset_requests", "handled_by", "BIGINT UNSIGNED NULL");
            await ctx.ensureColumn("password_reset_requests", "handled_at", "DATETIME NULL");
            await ctx.ensureColumn(
                "password_reset_requests",
                "updated_at",
                "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
            );
            await ctx.ensureIndex("password_reset_requests", "idx_password_reset_requests_user", "KEY `idx_password_reset_requests_user` (`user_id`)");
            await ctx.ensureIndex(
                "password_reset_requests",
                "idx_password_reset_requests_status",
                "KEY `idx_password_reset_requests_status` (`status`)"
            );
            await ctx.ensureIndex(
                "password_reset_requests",
                "idx_password_reset_requests_created",
                "KEY `idx_password_reset_requests_created` (`created_at`)"
            );
        }
    }
];

async function runMigrations(db, options = {}) {
    const verbose = options.verbose !== false;

    await ensureMigrationsTable(db);

    for (const migration of migrations) {
        if (await hasMigration(db, migration.key)) {
            if (verbose) {
                console.log(`Skipped migration: ${migration.key}`);
            }
            continue;
        }

        const context = createMigrationContext(db);
        await migration.run(context);
        await markMigrationApplied(db, migration.key);

        if (verbose) {
            console.log(`Applied migration: ${migration.key}`);
            if (context.actions.length) {
                for (const action of context.actions) {
                    console.log(`  - ${action}`);
                }
            } else {
                console.log("  - 无需额外结构变更");
            }
        }
    }
}

async function inspectDatabase(db) {
    await ensureMigrationsTable(db);

    const report = {
        healthy: true,
        applied_migrations: [],
        missing_tables: [],
        missing_columns: [],
        missing_indexes: []
    };

    const appliedRows = await db.prepare(`
        SELECT migration_key, applied_at
        FROM schema_migrations
        ORDER BY migration_key ASC
    `).all();
    report.applied_migrations = appliedRows;

    for (const expectation of SCHEMA_EXPECTATIONS) {
        const exists = await tableExists(db, expectation.table);
        if (!exists) {
            report.missing_tables.push(expectation.table);
            report.healthy = false;
            continue;
        }

        for (const columnName of expectation.columns) {
            if (!await columnExists(db, expectation.table, columnName)) {
                report.missing_columns.push(`${expectation.table}.${columnName}`);
                report.healthy = false;
            }
        }

        for (const indexName of expectation.indexes) {
            if (!await indexExists(db, expectation.table, indexName)) {
                report.missing_indexes.push(`${expectation.table}.${indexName}`);
                report.healthy = false;
            }
        }
    }

    return report;
}

async function initDatabase(options = {}) {
    const db = getDb();
    await runMigrations(db, options);
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
    inspectDatabase,
    tableExists,
    columnExists,
    indexExists
};
