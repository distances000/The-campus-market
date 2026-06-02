#!/bin/sh
set -eu

TEMPLATE_DIR="/etc/nginx/templates"
CONF_FILE="/etc/nginx/conf.d/default.conf"

normalize_domains() {
    printf "%s" "${DOMAINS:-}" | tr ',' ' ' | xargs
}

primary_domain() {
    normalize_domains | awk '{ print $1 }'
}

render_http_config() {
    NGINX_SERVER_NAME="${SERVER_NAMES:-_}" \
    NGINX_CLIENT_MAX_BODY_SIZE="${NGINX_CLIENT_MAX_BODY_SIZE:-20m}" \
    UPLOAD_PUBLIC_PREFIX="${UPLOAD_PUBLIC_PREFIX:-/uploads}" \
        envsubst '${NGINX_SERVER_NAME} ${NGINX_CLIENT_MAX_BODY_SIZE} ${UPLOAD_PUBLIC_PREFIX}' \
        < "${TEMPLATE_DIR}/http.conf.template" \
        > "${CONF_FILE}"
}

render_https_config() {
    NGINX_SERVER_NAME="${SERVER_NAMES:-_}" \
    PRIMARY_DOMAIN="${PRIMARY_DOMAIN:-}" \
    NGINX_CLIENT_MAX_BODY_SIZE="${NGINX_CLIENT_MAX_BODY_SIZE:-20m}" \
    UPLOAD_PUBLIC_PREFIX="${UPLOAD_PUBLIC_PREFIX:-/uploads}" \
        envsubst '${NGINX_SERVER_NAME} ${PRIMARY_DOMAIN} ${NGINX_CLIENT_MAX_BODY_SIZE} ${UPLOAD_PUBLIC_PREFIX}' \
        < "${TEMPLATE_DIR}/https.conf.template" \
        > "${CONF_FILE}"
}

cert_files_exist() {
    [ -n "${PRIMARY_DOMAIN:-}" ] \
        && [ -f "/etc/letsencrypt/live/${PRIMARY_DOMAIN}/fullchain.pem" ] \
        && [ -f "/etc/letsencrypt/live/${PRIMARY_DOMAIN}/privkey.pem" ]
}

render_config() {
    if [ "${ENABLE_HTTPS:-false}" = "true" ] && cert_files_exist; then
        CURRENT_MODE="https"
        render_https_config
        return
    fi

    CURRENT_MODE="http"
    render_http_config
}

certificate_signature() {
    if ! cert_files_exist; then
        return
    fi
    sha256sum \
        "/etc/letsencrypt/live/${PRIMARY_DOMAIN}/fullchain.pem" \
        "/etc/letsencrypt/live/${PRIMARY_DOMAIN}/privkey.pem" \
        | sha256sum \
        | awk '{ print $1 }'
}

watch_certificates() {
    PREVIOUS_SIGNATURE="$(certificate_signature || true)"

    while true; do
        sleep 30

        NEXT_MODE="http"
        if [ "${ENABLE_HTTPS:-false}" = "true" ] && cert_files_exist; then
            NEXT_MODE="https"
        fi

        NEXT_SIGNATURE="$(certificate_signature || true)"

        if [ "${NEXT_MODE}" != "${CURRENT_MODE}" ] || [ "${NEXT_SIGNATURE}" != "${PREVIOUS_SIGNATURE}" ]; then
            render_config
            nginx -s reload
            PREVIOUS_SIGNATURE="${NEXT_SIGNATURE}"
        fi
    done
}

SERVER_NAMES="$(normalize_domains)"
PRIMARY_DOMAIN="$(primary_domain)"
CURRENT_MODE="http"

render_config

if [ "${ENABLE_HTTPS:-false}" = "true" ]; then
    watch_certificates &
fi

nginx -g 'daemon off;' &
NGINX_PID=$!

wait "${NGINX_PID}"
