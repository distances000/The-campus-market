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

certificate_exists() {
    [ -n "${PRIMARY_DOMAIN:-}" ] && [ -f "/etc/letsencrypt/live/${PRIMARY_DOMAIN}/fullchain.pem" ]
}

issue_certificate() {
    certbot certonly \
        --non-interactive \
        --agree-tos \
        --email "${LETSENCRYPT_EMAIL}" \
        --webroot \
        --webroot-path /var/www/certbot \
        ${STAGING_ARG} \
        ${DOMAIN_ARGS} \
        --keep-until-expiring
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

trap exit TERM INT

while true; do
    if ! certificate_exists; then
        echo "Certificate not found for ${PRIMARY_DOMAIN}, trying to issue..."
        if issue_certificate; then
            echo "Certificate issued for ${PRIMARY_DOMAIN}."
        else
            echo "Certificate issue failed, retrying in 60 seconds."
            sleep 60
            continue
        fi
    fi

    certbot renew \
        --webroot \
        --webroot-path /var/www/certbot \
        ${STAGING_ARG} \
        --quiet || true
    sleep 43200 &
    wait $!
done
