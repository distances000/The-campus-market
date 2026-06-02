# 生产环境配置说明

本文档对应本项目当前的 Docker + Nginx + MySQL 生产部署方案。

## 1. 配置文件位置

- 根目录环境变量模板：`/.env.example`
- 后端本地环境模板：`/server/.env.example`
- 生产环境自检命令：`server` 目录下执行 `npm run doctor-env`

生产部署时，建议在项目根目录放置 `/.env`，再由 `docker compose` 统一注入各容器。

## 2. 必填配置项

### 应用与域名

- `APP_BASE_URL`
    - 生产环境对外访问地址
    - 开启 HTTPS 时必须是 `https://` 开头
    - 示例：`https://market.example.com`
- `APP_PRIMARY_DOMAIN`
    - 主域名
    - 示例：`market.example.com`
- `DOMAINS`
    - 需要写入 Nginx 和证书申请的域名列表
    - 多个域名用英文逗号分隔
    - 示例：`market.example.com,www.market.example.com`

### HTTPS 与证书

- `ENABLE_HTTPS`
    - `true` 表示启用 HTTPS 与 Certbot
    - `false` 表示只启用 HTTP
- `LETSENCRYPT_EMAIL`
    - Let's Encrypt 证书通知邮箱
- `LETSENCRYPT_STAGING`
    - 首次联调时可设为 `true`
    - 正式上线必须改回 `false`

### 端口

- `HTTP_PORT`
    - 宿主机映射到 Nginx `80` 的端口
    - 默认 `80`
- `HTTPS_PORT`
    - 宿主机映射到 Nginx `443` 的端口
    - 默认 `443`
- `PORT`
    - 后端容器内部监听端口
    - 当前固定使用 `3000`

### 数据库

- `MYSQL_DATABASE`
    - 业务数据库名
- `MYSQL_ROOT_PASSWORD`
    - MySQL root 密码
- `MYSQL_CONNECTION_LIMIT`
    - 后端连接池大小，默认 `10`

说明：

- Docker 生产方案当前使用 MySQL。
- 容器内后端通过 `DATABASE_URL` 自动拼接连接到 `mysql` 服务。
- 如果脱离 Docker 单独运行后端，也可以在 `server/.env` 中直接配置 `DATABASE_URL` 或 `MYSQL_*`。

### JWT 与后台安全

- `JWT_SECRET`
    - 必须为高强度随机字符串
    - 生产环境禁止使用默认值或 `change-this-*`
- `ADMIN_BOOTSTRAP_KEY`
    - 管理员初始化密钥
    - 用于受控启用第一个管理员账号

### 邮件

- `EMAIL_PROVIDER`
    - 生产环境必须配置为 `smtp`
- `EMAIL_CODE_SECRET`
    - 邮件验证码签名密钥
- `EMAIL_CODE_TTL_SECONDS`
    - 邮件验证码有效期，默认 `300`
- `EMAIL_CODE_COOLDOWN_SECONDS`
    - 获取验证码冷却时间，默认 `60`
- `EMAIL_SENDER_NAME`
    - 发件人显示名称
- `EMAIL_SMTP_HOST`
    - SMTP 主机
- `EMAIL_SMTP_PORT`
    - SMTP 端口
- `EMAIL_SMTP_SECURE`
    - `true` 时使用 SSL/TLS
- `EMAIL_SMTP_USER`
    - SMTP 用户名
- `EMAIL_SMTP_PASS`
    - SMTP 密码或授权码
- `EMAIL_FROM`
    - 实际发件地址
- `EMAIL_SMTP_REJECT_UNAUTHORIZED`
    - 是否校验证书，默认 `true`
- `EMAIL_SMTP_TIMEOUT_MS`
    - SMTP 连接超时，默认 `15000`

### 上传目录

- `UPLOAD_DIR`
    - 后端容器内上传目录
    - 默认建议值：`/app/uploads`
- `UPLOAD_PUBLIC_PREFIX`
    - 上传文件静态访问前缀
    - 默认建议值：`/uploads`
- `UPLOAD_MAX_BODY_SIZE`
    - Nginx 接收上传请求的最大体积
    - 当前建议值：`20m`

说明：

- Docker Compose 已将上传目录挂到卷 `server_uploads`。
- Nginx 会把 `UPLOAD_MAX_BODY_SIZE` 注入反向代理配置。
- 后端会把 `UPLOAD_PUBLIC_PREFIX` 作为静态路径暴露出来。

### 备份与恢复

- `BACKUP_ROOT_DIR`
    - 备份文件在宿主机上的输出目录
    - 建议值：`./backups`
- `BACKUP_RETENTION_DAYS`
    - 自动清理多少天前的旧备份
    - 建议值：`7`
- `RESTORE_STOP_APPLICATION`
    - 恢复时是否自动停止业务服务
    - 建议值：`true`
- `RESTORE_STOP_SERVICES`
    - 恢复时需要停止并在完成后拉起的服务列表
    - 建议值：`nginx frontend server1 server2`

## 3. 生产环境最小示例

```env
APP_BASE_URL=https://market.example.com
APP_PRIMARY_DOMAIN=market.example.com
DOMAINS=market.example.com,www.market.example.com
ENABLE_HTTPS=true
LETSENCRYPT_EMAIL=admin@example.com
LETSENCRYPT_STAGING=false

HTTP_PORT=80
HTTPS_PORT=443

MYSQL_DATABASE=campus_market
MYSQL_ROOT_PASSWORD=replace-with-strong-password
MYSQL_CONNECTION_LIMIT=10

JWT_SECRET=replace-with-a-long-random-secret
ADMIN_BOOTSTRAP_KEY=replace-with-another-long-random-secret

EMAIL_PROVIDER=smtp
EMAIL_CODE_SECRET=replace-with-a-third-long-random-secret
EMAIL_CODE_TTL_SECONDS=300
EMAIL_CODE_COOLDOWN_SECONDS=60
EMAIL_SENDER_NAME=校园集市
EMAIL_SMTP_HOST=smtp.example.com
EMAIL_SMTP_PORT=465
EMAIL_SMTP_SECURE=true
EMAIL_SMTP_USER=service@example.com
EMAIL_SMTP_PASS=replace-with-smtp-auth-code
EMAIL_FROM=service@example.com
EMAIL_SMTP_REJECT_UNAUTHORIZED=true
EMAIL_SMTP_TIMEOUT_MS=15000

UPLOAD_DIR=/app/uploads
UPLOAD_PUBLIC_PREFIX=/uploads
UPLOAD_MAX_BODY_SIZE=20m

BACKUP_ROOT_DIR=./backups
BACKUP_RETENTION_DAYS=7
RESTORE_STOP_APPLICATION=true
RESTORE_STOP_SERVICES=nginx frontend server1 server2
```

## 4. 启动前检查

### 宿主机

- 域名已解析到服务器公网 IP
- `80` 与 `443` 端口已放行
- Docker 与 Docker Compose 可用

### 项目

- 复制并填写根目录 `.env`
- 执行：

```powershell
cd server
cmd /c npm run doctor-env
```

- 结果必须为：
    - `valid: true`

## 5. 启动命令

```powershell
docker compose up -d --build
```

## 6. 常见错误

### `JWT_SECRET` 默认值被拒绝

说明：

- 生产环境下，后端会拒绝默认 JWT 密钥和明显占位值。

### 开启 HTTPS 但未配置域名

说明：

- `ENABLE_HTTPS=true` 时，`APP_BASE_URL`、`APP_PRIMARY_DOMAIN`、`DOMAINS`、`LETSENCRYPT_EMAIL` 必须完整。

### 邮件验证码不工作

说明：

- 生产环境强制要求 `EMAIL_PROVIDER=smtp`
- 缺少 SMTP 主机、账号、授权码或发件地址都会直接被 `doctor-env` 和启动校验拦住

### 上传失败

说明：

- 检查 `UPLOAD_DIR` 是否和 Docker 卷挂载一致
- 检查 `UPLOAD_MAX_BODY_SIZE` 是否大于前端允许上传的图片大小
- 检查 `UPLOAD_PUBLIC_PREFIX` 是否仍然为 `/uploads`

### 备份或恢复失败

说明：

- 检查 `docker compose ps` 中 `mysql`、`server1` 是否可用
- 检查根目录 `.env` 是否包含 `MYSQL_DATABASE`、`MYSQL_ROOT_PASSWORD`
- 检查 `BACKUP_ROOT_DIR` 所在磁盘空间是否足够
- 恢复前必须确认备份目录里同时存在：
    - `mysql.sql`
    - `uploads.tar.gz`

## 7. HTTPS 验收

上线前请继续按下面文档逐项确认：

- [https-checklist.md](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\deploy\https-checklist.md)
- [backup-plan.md](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\deploy\backup\backup-plan.md)
