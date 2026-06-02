#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
cd "$PROJECT_ROOT"

if [ -f "$PROJECT_ROOT/.env" ]; then
    set -a
    . "$PROJECT_ROOT/.env"
    set +a
fi

BACKUP_ROOT_DIR=${BACKUP_ROOT_DIR:-"$PROJECT_ROOT/backups"}
BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-7}
MYSQL_SERVICE=${MYSQL_SERVICE:-mysql}
UPLOADS_SOURCE_SERVICE=${UPLOADS_SOURCE_SERVICE:-server1}
TIMESTAMP=${BACKUP_TIMESTAMP:-$(date +"%Y%m%d-%H%M%S")}
TARGET_DIR="$BACKUP_ROOT_DIR/$TIMESTAMP"

mkdir -p "$TARGET_DIR"

echo "[backup] target directory: $TARGET_DIR"
echo "[backup] dumping mysql database"
docker compose exec -T "$MYSQL_SERVICE" sh -lc \
    'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --quick --routines --events --default-character-set=utf8mb4 "$MYSQL_DATABASE"' \
    > "$TARGET_DIR/mysql.sql"

echo "[backup] archiving uploads"
docker compose exec -T "$UPLOADS_SOURCE_SERVICE" sh -lc \
    'cd /app && tar -czf - uploads' \
    > "$TARGET_DIR/uploads.tar.gz"

cat > "$TARGET_DIR/manifest.txt" <<EOF
timestamp=$TIMESTAMP
app_base_url=${APP_BASE_URL:-}
mysql_service=$MYSQL_SERVICE
uploads_source_service=$UPLOADS_SOURCE_SERVICE
backup_root_dir=$BACKUP_ROOT_DIR
EOF

if [ "$BACKUP_RETENTION_DAYS" -gt 0 ] 2>/dev/null; then
    echo "[backup] cleaning expired backups older than $BACKUP_RETENTION_DAYS day(s)"
    find "$BACKUP_ROOT_DIR" -mindepth 1 -maxdepth 1 -type d -mtime +"$BACKUP_RETENTION_DAYS" -exec rm -rf {} +
fi

echo "[backup] completed: $TARGET_DIR"

if [ "${BACKUP_PRINT_PATH:-false}" = "true" ]; then
    printf '%s\n' "$TARGET_DIR"
fi
