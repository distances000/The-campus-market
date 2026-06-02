#!/bin/sh
set -eu

if [ $# -lt 2 ] || [ "$2" != "--force" ]; then
    echo "用法: sh deploy/backup/restore-backup.sh <备份目录> --force"
    echo "示例: sh deploy/backup/restore-backup.sh backups/20260602-120000 --force"
    exit 1
fi

BACKUP_DIR=$1

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
cd "$PROJECT_ROOT"

if [ -f "$PROJECT_ROOT/.env" ]; then
    set -a
    . "$PROJECT_ROOT/.env"
    set +a
fi

MYSQL_SERVICE=${MYSQL_SERVICE:-mysql}
UPLOADS_TARGET_SERVICE=${UPLOADS_TARGET_SERVICE:-server1}
RESTORE_STOP_APPLICATION=${RESTORE_STOP_APPLICATION:-true}
RESTORE_STOP_SERVICES=${RESTORE_STOP_SERVICES:-"nginx frontend server1 server2"}
SQL_FILE="$BACKUP_DIR/mysql.sql"
UPLOADS_ARCHIVE="$BACKUP_DIR/uploads.tar.gz"

if [ ! -f "$SQL_FILE" ]; then
    echo "[restore] missing file: $SQL_FILE"
    exit 1
fi

if [ ! -f "$UPLOADS_ARCHIVE" ]; then
    echo "[restore] missing file: $UPLOADS_ARCHIVE"
    exit 1
fi

STOPPED=0

restart_stopped_services() {
    if [ "$STOPPED" -eq 1 ]; then
        echo "[restore] restarting application services"
        docker compose up -d $RESTORE_STOP_SERVICES >/dev/null
    fi
}

trap restart_stopped_services EXIT

echo "[restore] ensuring mysql is running"
docker compose up -d "$MYSQL_SERVICE" >/dev/null

if [ "$RESTORE_STOP_APPLICATION" = "true" ]; then
    echo "[restore] stopping application services"
    docker compose stop $RESTORE_STOP_SERVICES >/dev/null || true
    STOPPED=1
fi

echo "[restore] restoring mysql database from $SQL_FILE"
docker compose exec -T "$MYSQL_SERVICE" sh -lc \
    'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' \
    < "$SQL_FILE"

echo "[restore] restoring uploads from $UPLOADS_ARCHIVE"
docker compose run --rm -T --no-deps "$UPLOADS_TARGET_SERVICE" sh -lc \
    'mkdir -p /app/uploads && find /app/uploads -mindepth 1 -maxdepth 1 -exec rm -rf {} + && cd /app && tar -xzf -' \
    < "$UPLOADS_ARCHIVE"

echo "[restore] completed from $BACKUP_DIR"
