FROM nginx:1.27-alpine

RUN apk add --no-cache bash gettext

COPY deploy/nginx/entrypoint.sh /entrypoint.sh
COPY deploy/nginx/templates /etc/nginx/templates

RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
