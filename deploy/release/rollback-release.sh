#!/bin/sh
set -eu

if [ $# -lt 2 ] || [ "$2" != "--force" ]; then
    echo "用法: sh deploy/release/rollback-release.sh <release.env> --force"
    echo "示例: sh deploy/release/rollback-release.sh release-state/releases/20260602-120000/release.env --force"
    exit 1
fi

MANIFEST_FILE=$1

if [ ! -f "$MANIFEST_FILE" ]; then
    echo "[rollback] manifest not found: $MANIFEST_FILE"
    exit 1
fi

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
cd "$PROJECT_ROOT"

if [ -f "$PROJECT_ROOT/.env" ]; then
    set -a
    . "$PROJECT_ROOT/.env"
    set +a
fi

set -a
. "$MANIFEST_FILE"
set +a

RELEASE_STATE_DIR=${RELEASE_STATE_DIR:-"$PROJECT_ROOT/release-state"}
OVERRIDE_DIR="$RELEASE_STATE_DIR/runtime"
OVERRIDE_FILE="$OVERRIDE_DIR/rollback-${RELEASE_TIMESTAMP}.override.yml"
mkdir -p "$OVERRIDE_DIR"

{
    echo "services:"
    for service in $RELEASE_ROLLBACK_SERVICES; do
        service_key=$(printf '%s' "$service" | tr '[:lower:]-' '[:upper:]_')
        image_var="SERVICE_${service_key}_IMAGE"
        eval image_id=\${$image_var:-}

        if [ -z "${image_id:-}" ]; then
            echo "[rollback] missing image id for service: $service" >&2
            exit 1
        fi

        echo "    $service:"
        echo "        image: \"$image_id\""
        echo "        pull_policy: never"
    done
} > "$OVERRIDE_FILE"

echo "[rollback] using manifest: $MANIFEST_FILE"
echo "[rollback] pinned override: $OVERRIDE_FILE"

docker compose -f docker-compose.yml -f "$OVERRIDE_FILE" up -d --no-build --force-recreate $RELEASE_ROLLBACK_SERVICES

echo "[rollback] application services reverted to release snapshot: $RELEASE_TIMESTAMP"
echo "[rollback] linked backup directory: ${BACKUP_DIR:-未记录}"
echo "[rollback] if the bad release changed database schema or data incompatibly, run restore-backup with the linked backup."
