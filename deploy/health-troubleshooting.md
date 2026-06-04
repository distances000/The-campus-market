# 健康检查与排障说明

本文档只说明怎么检查服务是否健康，以及服务启动失败、数据库连接失败、邮件失败、上传失败时怎么排查。

## 健康检查入口

### Docker 服务状态

```powershell
docker compose ps
```

重点看这些服务：

1. `mysql`
2. `server1`
3. `server2`
4. `frontend`
5. `nginx`
6. `certbot`

预期：

1. 服务状态为 `Up`
2. 带健康检查的服务应显示 `healthy`

### 后端健康检查

```powershell
curl http://127.0.0.1:3000/api/health
```

如果走 Nginx 对外入口：

```powershell
curl http://127.0.0.1/api/health
curl https://你的域名/api/health
```

预期：

1. 返回 `200`
2. 返回 JSON，包含 `code: 200`

### Nginx 健康检查

```powershell
curl http://127.0.0.1/nginx-health
```

预期：

1. 返回 `200`
2. 返回 `ok`

### 数据库健康检查

```powershell
docker compose exec mysql mysqladmin ping -h 127.0.0.1 -uroot -p%MYSQL_ROOT_PASSWORD% --silent
```

如果当前是 Linux shell：

```bash
docker compose exec mysql sh -lc 'mysqladmin ping -h 127.0.0.1 -uroot -p"$MYSQL_ROOT_PASSWORD" --silent'
```

预期：

1. MySQL 返回 `mysqld is alive`

### 环境和结构自检

```powershell
cd C:\Users\33981\Documents\MyProjects\Web\The-campus-market\server
cmd /c npm run doctor-env
cmd /c npm run doctor-db
```

预期：

1. `doctor-env` 返回 `valid: true`
2. `doctor-db` 返回 `healthy: true`

## 服务启动失败怎么查

### 先看哪一层失败

先执行：

```powershell
docker compose ps
docker compose logs --tail=200 server1
docker compose logs --tail=200 server2
docker compose logs --tail=200 nginx
docker compose logs --tail=200 mysql
```

排查顺序：

1. 先看 `mysql` 是否健康
2. 再看 `server1` / `server2` 是否启动成功
3. 最后看 `nginx` 是否只是被上游健康检查卡住

### 常见原因

1. 根目录 `.env` 缺关键变量
2. `JWT_SECRET` 或 `ADMIN_BOOTSTRAP_KEY` 仍是占位值
3. `DATABASE_URL` 或 `MYSQL_*` 配错
4. 上传目录挂载异常
5. HTTPS 开启但域名或证书参数不完整

### 固定检查命令

```powershell
cd C:\Users\33981\Documents\MyProjects\Web\The-campus-market\server
cmd /c npm run doctor-env
```

如果 `doctor-env` 不通过，先修环境变量，不要继续重启服务碰运气。

## 数据库连接失败怎么查

### 现象

常见表现：

1. 后端启动直接退出
2. `/api/health` 不通
3. 日志里出现 `ECONNREFUSED`
4. `doctor-db` 失败

### 排查步骤

1. 检查 MySQL 容器是否健康

```powershell
docker compose ps mysql
docker compose logs --tail=200 mysql
```

2. 检查数据库配置

```powershell
cd C:\Users\33981\Documents\MyProjects\Web\The-campus-market\server
cmd /c npm run doctor-env
```

重点确认：

1. `DATABASE_URL` 是否正确
2. 或者 `MYSQL_HOST` / `MYSQL_PORT` / `MYSQL_USER` / `MYSQL_PASSWORD` / `MYSQL_DATABASE` 是否齐全
3. Docker 场景下是否实际使用了 `mysql` 作为主机名

3. 检查数据库结构

```powershell
cmd /c npm run doctor-db
```

4. 如果是首次部署或恢复后

```powershell
cmd /c npm run migrate-db
cmd /c npm run doctor-db
```

### 常见原因

1. MySQL 根本没起来
2. 数据库密码写错
3. 数据库名不存在
4. 恢复历史备份后没补迁移
5. Docker 网络里的主机名不是 `mysql`

## 邮件失败怎么查

### 先看当前是不是本来就不发邮件

如果是：

```env
EMAIL_PROVIDER=console
```

那就不是故障，而是只打印验证码到后端日志，不真实投递。

### 真发邮件时的排查步骤

1. 检查邮件配置

```powershell
cd C:\Users\33981\Documents\MyProjects\Web\The-campus-market\server
cmd /c npm run doctor-env
```

重点确认：

1. `EMAIL_PROVIDER=smtp`
2. `EMAIL_SMTP_HOST`
3. `EMAIL_SMTP_PORT`
4. `EMAIL_SMTP_SECURE`
5. `EMAIL_SMTP_USER`
6. `EMAIL_SMTP_PASS`
7. `EMAIL_FROM`
8. `EMAIL_CODE_SECRET`

2. 看后端日志

```powershell
docker compose logs --tail=200 server1
docker compose logs --tail=200 server2
```

重点看：

1. `email.console_code_generated`
2. SMTP 连接超时
3. SMTP 登录失败
4. 证书校验失败

3. 如果只有一台实例在发邮件，也可以只看对应实例

```powershell
docker compose logs -f server1
```

### 常见原因

1. `EMAIL_PROVIDER` 仍是 `console`
2. SMTP 主机或端口写错
3. 邮箱账号或授权码写错
4. `EMAIL_FROM` 不被服务商允许
5. `EMAIL_SMTP_SECURE` 与端口不匹配
6. 外网访问 SMTP 被网络策略拦住

## 上传失败怎么查

### 现象

常见表现：

1. 上传接口返回 `400`
2. 上传接口返回 `500`
3. 文件上传成功但图片打不开
4. 大图上传失败

### 排查步骤

1. 看后端日志

```powershell
docker compose logs --tail=200 server1
docker compose logs --tail=200 server2
```

重点看：

1. `upload.rejected`
2. `upload.single_succeeded`
3. `upload.batch_succeeded`

2. 确认上传相关配置

重点确认：

1. `UPLOAD_DIR`
2. `UPLOAD_PUBLIC_PREFIX`
3. `UPLOAD_MAX_BODY_SIZE`

3. 确认静态资源能否访问

```powershell
curl http://127.0.0.1/uploads/某个已存在文件名
curl https://你的域名/uploads/某个已存在文件名
```

4. 确认卷挂载是否正常

```powershell
docker compose exec server1 sh -lc "ls -la /app/uploads"
docker compose exec server2 sh -lc "ls -la /app/uploads"
```

### 常见原因

1. 文件格式不被允许
2. 文件大小超过限制
3. Nginx `client_max_body_size` 太小
4. `UPLOAD_DIR` 没挂对
5. `UPLOAD_PUBLIC_PREFIX` 和后端静态路由不一致
6. 多实例共享上传卷异常

## 建议的固定排障顺序

线上出故障时，按这个顺序最稳：

1. `docker compose ps`
2. `docker compose logs --tail=200 mysql`
3. `docker compose logs --tail=200 server1`
4. `docker compose logs --tail=200 server2`
5. `docker compose logs --tail=200 nginx`
6. `cmd /c npm run doctor-env`
7. `cmd /c npm run doctor-db`
8. `curl /api/health`
9. 再针对邮件或上传走专项检查
