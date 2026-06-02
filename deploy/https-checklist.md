# HTTPS 验收清单

本文档用于确认本项目生产环境的 HTTPS 真的可用，而不是“看起来配了”。

## 1. 前置条件

- `APP_BASE_URL` 已配置为 `https://你的域名`
- `APP_PRIMARY_DOMAIN` 已配置为主域名
- `DOMAINS` 已配置为要签发证书的域名列表
- `ENABLE_HTTPS=true`
- `LETSENCRYPT_EMAIL` 已配置
- 域名已解析到服务器公网 IP
- 宿主机 `80` 与 `443` 端口已放行

## 2. 首次签发确认

启动：

```powershell
docker compose up -d --build
```

查看证书申请日志：

```powershell
docker compose logs -f certbot
```

预期：

- 出现 `Certificate issued for <主域名>.`
- 如果 Nginx 启动稍慢，脚本会每 60 秒自动重试一次
- 不需要手工重启 `certbot`

## 3. Nginx 配置确认

查看 Nginx 日志：

```powershell
docker compose logs -f nginx
```

预期：

- 启动前会先执行 `nginx -t`
- 证书文件出现或更新后，会再次 `nginx -t` 再 `reload`
- 不会在坏配置上直接重载

## 4. HTTP 跳转确认

执行：

```powershell
curl -I http://你的域名
```

预期：

- 返回 `301`
- `Location` 指向 `https://你的域名/...`

说明：

- 在证书尚未签发完成前，Nginx 会先使用 HTTP 配置承接 ACME 验证
- 证书签发成功后，80 端口会切换为跳转到 HTTPS

## 5. HTTPS 证书确认

执行：

```powershell
curl -I https://你的域名
```

预期：

- 可以正常建立 HTTPS 连接
- 返回前端首页响应头

浏览器确认：

- 地址栏无证书错误
- 证书域名和访问域名一致

## 6. 反向代理确认

### 前端

```powershell
curl -I https://你的域名/
```

预期：

- 返回前端页面

### API

```powershell
curl -I https://你的域名/api/health
```

预期：

- 返回 `200`

### 上传静态资源

```powershell
curl -I https://你的域名/uploads/某个已存在文件名
```

预期：

- 返回 `200` 或至少不是证书/代理层错误

### WebSocket

说明：

- Nginx 已对 `/ws` 配置 `Upgrade` 与 `Connection` 头
- 并设置了 `proxy_read_timeout 3600`
- 适合当前实时聊天链路

建议实际验证：

- 打开两个账号聊天
- 确认 HTTPS 域名下消息实时推送正常

## 7. 续期确认

当前机制：

- `certbot` 容器每 12 小时执行一次 `certbot renew`
- Nginx 容器每 30 秒检查证书文件签名
- 发现证书更新后会自动重载 Nginx

确认命令：

```powershell
docker compose logs -f certbot
docker compose logs -f nginx
```

预期：

- `certbot renew` 周期性执行
- 证书变化后 Nginx 自动 reload

## 8. 健康检查确认

Nginx 健康检查使用：

- `http://127.0.0.1/nginx-health`

说明：

- 这个地址固定返回 `200 ok`
- 不受 HTTP 跳转影响
- 不依赖前端、后端业务是否正常

## 9. 常见失败点

### 证书一直签不下来

重点检查：

- 域名解析是否正确
- `80` 端口是否放行
- `DOMAINS` 是否与实际访问域名一致
- `LETSENCRYPT_EMAIL` 是否填写

### HTTPS 能打开但 API 不通

重点检查：

- `server1`、`server2` 是否健康
- `/api/health` 是否返回 `200`
- Nginx upstream 是否都已启动

### HTTPS 正常但聊天断开

重点检查：

- `/ws` 是否经过反向代理
- 浏览器控制台是否有 WebSocket 握手错误
- Nginx 日志里是否出现升级失败
