# The-campus-market

## 生产部署

项目已经补齐了容器化部署基座：

- `client/Dockerfile`
- `server/Dockerfile`
- `docker-compose.yml`
- `deploy/nginx/*`
- `deploy/certbot/entrypoint.sh`

部署架构：

- `postgres`
    - PostgreSQL 数据库
- `server1`
    - Node.js 后端实例 1
- `server2`
    - Node.js 后端实例 2
- `frontend`
    - 前端静态站点容器
- `nginx`
    - 统一入口
    - 负责前端静态代理
    - 负责 `/api`、`/ws`、`/uploads` 反向代理
    - 负责对 `server1`、`server2` 做负载均衡
- `certbot`
    - Let's Encrypt 证书申请和自动续期

## 启动前准备

1. 复制环境变量模板

```powershell
copy .env.example .env
```

2. 修改 `.env`

最少要改这些：

- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `DOMAINS`
- `LETSENCRYPT_EMAIL`

说明：

- `DOMAINS`
    - 多个域名用英文逗号分隔
    - 例如 `example.com,www.example.com`
- `ENABLE_HTTPS`
    - 本地测试可设为 `false`
    - 正式上线建议设为 `true`
- `LETSENCRYPT_STAGING`
    - 首次调试证书申请流程时可设为 `true`
    - 正式上线前改回 `false`

3. 如果开启 HTTPS，先确认：

- 域名已解析到服务器公网 IP
- 服务器已放行 `80` 和 `443` 端口

## 一键启动

```powershell
docker compose up -d --build
```

首次启动时会自动完成：

- PostgreSQL 初始化
- 后端建表
- 前端构建
- Nginx 反向代理启动
- `certbot` 证书申请和续期循环

如果：

- `ENABLE_HTTPS=false`
    - Nginx 会先以 HTTP 模式启动
- `ENABLE_HTTPS=true`
    - Nginx 会先提供 HTTP 和 ACME challenge
    - 证书签发成功后会自动切到 HTTPS 配置

## 常用命令

查看服务状态：

```powershell
docker compose ps
```

查看日志：

```powershell
docker compose logs -f
```

只看 Nginx：

```powershell
docker compose logs -f nginx
```

只看证书申请：

```powershell
docker compose logs -f certbot
```

停止服务：

```powershell
docker compose down
```

保留数据的前提下重建：

```powershell
docker compose up -d --build
```

## 持久化数据

以下数据通过 Docker Volume 持久化：

- `postgres_data`
    - PostgreSQL 数据
- `server_uploads`
    - 用户上传图片
- `certbot_www`
    - ACME challenge 文件
- `letsencrypt`
    - HTTPS 证书

## 负载均衡说明

Nginx 当前会把后端流量分发到：

- `server1`
- `server2`

策略使用：

- `least_conn`

适用于：

- 普通 API 请求
- WebSocket 升级请求

如果后续要继续横向扩容，建议下一步把后端实例数改成更系统的服务发现方案，而不是继续手工增加 `server3`、`server4`。

## 注意事项

1. 这个部署方案默认后端连接 PostgreSQL，不再使用 SQLite
2. WebSocket 已通过 Nginx 配置转发
3. 上传文件目录已经做了共享卷，两个后端实例不会各写各的
4. 首次申请证书失败时，先检查：
   - 域名解析
   - 80 端口是否可访问
   - `DOMAINS` 是否填写正确
   - `LETSENCRYPT_EMAIL` 是否填写正确
