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

RELEASE_STATE_DIR=${RELEASE_STATE_DIR:-"$PROJECT_ROOT/release-state"}
RELEASE_ROLLBACK_SERVICES=${RELEASE_ROLLBACK_SERVICES:-"frontend server1 server2 nginx certbot"}
TIMESTAMP=${RELEASE_TIMESTAMP:-$(date +"%Y%m%d-%H%M%S")}
MANIFEST_DIR="$RELEASE_STATE_DIR/releases/$TIMESTAMP"
MANIFEST_FILE="$MANIFEST_DIR/release.env"

mkdir -p "$MANIFEST_DIR"

echo "[release] creating pre-release backup"
BACKUP_PRINT_PATH=true BACKUP_TIMESTAMP="$TIMESTAMP" sh "$PROJECT_ROOT/deploy/backup/create-backup.sh" > "$MANIFEST_DIR/.backup-path.tmp"
BACKUP_DIR=$(tail -n 1 "$MANIFEST_DIR/.backup-path.tmp")
rm -f "$MANIFEST_DIR/.backup-path.tmp"

echo "[release] capturing running service images"
{
    printf 'RELEASE_TIMESTAMP=%s\n' "$TIMESTAMP"
    printf 'BACKUP_DIR=%s\n' "$BACKUP_DIR"
    printf 'RELEASE_ROLLBACK_SERVICES="%s"\n' "$RELEASE_ROLLBACK_SERVICES"

    for service in $RELEASE_ROLLBACK_SERVICES; do
        container_id=$(docker compose ps -q "$service" || true)
        if [ -z "$container_id" ]; then
            echo "[release] service not running: $service" >&2
            exit 1
        fi

        image_id=$(docker inspect --format '{{.Image}}' "$container_id")
        service_key=$(printf '%s' "$service" | tr '[:lower:]-' '[:upper:]_')
        printf 'SERVICE_%s_IMAGE=%s\n' "$service_key" "$image_id"
    done
} > "$MANIFEST_FILE"

echo "[release] manifest created: $MANIFEST_FILE"
echo "[release] backup linked: $BACKUP_DIR"
