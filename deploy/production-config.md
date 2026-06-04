# 环境变量说明

本文档只说明环境变量本身，不展开部署细节。

## 配置文件位置

根目录生产模板：

1. [.env.example](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\.env.example)

后端本地模板：

1. [server/.env.example](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\server\.env.example)

后端环境自检命令：

```powershell
cd C:\Users\33981\Documents\MyProjects\Web\The-campus-market\server
cmd /c npm run doctor-env
```

## 数据库

### 生产 Docker 部署常用

1. `MYSQL_DATABASE`
    - 业务数据库名
    - 示例：`campus_market`
2. `MYSQL_ROOT_PASSWORD`
    - MySQL root 密码
    - 必填
3. `MYSQL_CONNECTION_LIMIT`
    - 后端连接池大小
    - 默认建议：`10`

### 后端单独运行时可选

1. `DATABASE_URL`
    - 完整连接串
    - 示例：`mysql://root:password@127.0.0.1:3306/campus_market`
2. `MYSQL_HOST`
3. `MYSQL_PORT`
4. `MYSQL_USER`
5. `MYSQL_PASSWORD`
6. `MYSQL_DATABASE`

规则：

1. 后端可以直接用 `DATABASE_URL`
2. 也可以拆成 `MYSQL_*`
3. 生产环境至少要明确一种，不要同时留空

## JWT

1. `JWT_SECRET`
    - 登录令牌签名密钥
    - 必填
    - 必须使用高强度随机字符串
    - 禁止使用 `change-this-*`、`123456`、项目默认值

作用：

1. 用户登录后签发 token
2. 所有鉴权接口依赖它校验 token

## 管理员初始化密钥

1. `ADMIN_BOOTSTRAP_KEY`
    - 管理员初始化密钥
    - 必填
    - 必须与 `JWT_SECRET` 不同

作用：

1. 首个管理员账号初始化时校验
2. 防止任意普通用户直接调用初始化接口

## 邮件

### 总开关

1. `EMAIL_PROVIDER`
    - `console` 表示只打印到控制台
    - `smtp` 表示真实发邮件

### 验证码相关

1. `EMAIL_CODE_SECRET`
    - 邮件验证码签名密钥
    - 必填
2. `EMAIL_CODE_TTL_SECONDS`
    - 验证码有效期
    - 默认：`300`
3. `EMAIL_CODE_COOLDOWN_SECONDS`
    - 发送冷却时间
    - 默认：`60`
4. `EMAIL_SENDER_NAME`
    - 发件人显示名
    - 示例：`校园集市`

### SMTP 相关

当 `EMAIL_PROVIDER=smtp` 时，下面这些都要填：

1. `EMAIL_SMTP_HOST`
2. `EMAIL_SMTP_PORT`
3. `EMAIL_SMTP_SECURE`
4. `EMAIL_SMTP_USER`
5. `EMAIL_SMTP_PASS`
6. `EMAIL_FROM`
7. `EMAIL_SMTP_REJECT_UNAUTHORIZED`
8. `EMAIL_SMTP_TIMEOUT_MS`

示例：

1. `EMAIL_SMTP_HOST=smtp.qiye.aliyun.com`
2. `EMAIL_SMTP_PORT=465`
3. `EMAIL_SMTP_SECURE=true`
4. `EMAIL_FROM=service@example.com`

## 上传路径

1. `UPLOAD_DIR`
    - 后端实际保存上传文件的目录
    - Docker 默认建议：`/app/uploads`
    - 本地开发默认建议：`./uploads`
2. `UPLOAD_PUBLIC_PREFIX`
    - 上传文件的静态访问前缀
    - 默认：`/uploads`
3. `UPLOAD_MAX_BODY_SIZE`
    - 反向代理允许的上传体积上限
    - 默认建议：`20m`

规则：

1. `UPLOAD_DIR` 要和容器挂载卷一致
2. `UPLOAD_PUBLIC_PREFIX` 要和后端静态路由一致
3. 修改上传路径后，要同步检查 Nginx 代理和清理脚本

## 域名与 HTTPS

1. `APP_BASE_URL`
    - 对外访问地址
    - 示例：`https://market.example.com`
2. `APP_PRIMARY_DOMAIN`
    - 主域名
    - 示例：`market.example.com`
3. `DOMAINS`
    - 证书申请和 Nginx 使用的域名列表
    - 多个域名用英文逗号分隔
4. `ENABLE_HTTPS`
    - `true` 或 `false`
5. `LETSENCRYPT_EMAIL`
    - 证书通知邮箱
6. `LETSENCRYPT_STAGING`
    - 首次联调可设为 `true`
    - 正式上线必须回到 `false`

## 端口

1. `PORT`
    - 后端服务监听端口
    - 默认：`3000`
2. `HTTP_PORT`
    - 宿主机 HTTP 端口
    - 默认：`80`
3. `HTTPS_PORT`
    - 宿主机 HTTPS 端口
    - 默认：`443`

## 最小生产示例

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
```

## 检查顺序

改完环境变量后，至少按这个顺序检查：

1. `cmd /c npm run doctor-env`
2. `cmd /c npm run doctor-db`
3. `cmd /c npm run regress:local`
