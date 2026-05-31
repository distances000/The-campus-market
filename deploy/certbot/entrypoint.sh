#!/bin/sh
set -eu

normalize_domains() {
    printf "%s" "${DOMAINS:-}" | tr ',' ' ' | xargs
}

build_domain_args() {
    args=""
    for domain in $(normalize_domains); do
        if [ -n "${domain}" ]; then
            args="${args} -d ${domain}"
        fi
    done
    printf "%s" "${args}"
}

first_domain() {
    normalize_domains | awk '{ print $1 }'
}

if [ "${ENABLE_HTTPS:-false}" != "true" ]; then
    echo "HTTPS disabled, certbot idle."
    tail -f /dev/null
fi

if [ -z "${LETSENCRYPT_EMAIL:-}" ] || [ -z "${DOMAINS:-}" ]; then
    echo "LETSENCRYPT_EMAIL or DOMAINS is missing, certbot idle."
    tail -f /dev/null
fi

PRIMARY_DOMAIN="$(first_domain)"
DOMAIN_ARGS="$(build_domain_args)"
STAGING_ARG=""

if [ "${LETSENCRYPT_STAGING:-false}" = "true" ]; then
    STAGING_ARG="--staging"
fi

if [ ! -f "/etc/letsencrypt/live/${PRIMARY_DOMAIN}/fullchain.pem" ]; then
    certbot certonly \
        --non-interactive \
        --agree-tos \
        --email "${LETSENCRYPT_EMAIL}" \
        --webroot \
        --webroot-path /var/www/certbot \
        ${STAGING_ARG} \
        ${DOMAIN_ARGS} \
        --keep-until-expiring
fi

trap exit TERM INT

while true; do
    certbot renew \
        --webroot \
        --webroot-path /var/www/certbot \
        ${STAGING_ARG} \
        --quiet || true
    sleep 43200 &
    wait $!
done
