# The-campus-market

校园二手交易与校园圈项目。

前端使用 `Vue 3 + Vite`，后端使用 `Node.js + Express + MySQL`。项目界面采用自实现的 MD3-like 风格，不依赖官方 Material Web 组件库。

## 项目功能

当前已经接入并回归过的核心能力：

1. 账号体系
    - 注册
    - 登录
    - 退出登录
    - 修改密码
    - 找回密码申请
    - 管理员人工处理找回密码
2. 商品交易
    - 商品发布
    - 商品编辑
    - 商品上架 / 下架 / 标记售出 / 删除
    - 商品收藏
    - 商品详情与卖家资料展示
3. 校园圈
    - 发帖
    - 评论
    - 点赞
    - 删除帖子
4. 即时互动
    - 私信聊天
    - 好友搜索
    - 添加好友 / 删除好友
    - 最近会话管理
    - 系统通知 / 互动通知
5. 订单与信用
    - 下单
    - 取消订单
    - 完成订单
    - 双方评价
    - 信用统计
6. 内容治理
    - 举报商品 / 举报帖子
    - 管理员处理举报
    - 下架商品
    - 删除帖子
    - 处理备注
7. 交付与运维
    - MySQL 迁移式初始化
    - 本地回归脚本
    - Docker / Nginx / HTTPS 部署基座
    - 数据备份与恢复脚本

## 目录结构

```text
client/                  前端项目
server/                  后端项目
deploy/                  部署、备份、回滚、排障文档与脚本
scripts/                 根目录统一校验脚本
docker-compose.yml       容器编排文件
package.json             根目录统一命令入口
```

## 环境要求

本地开发至少需要：

1. `Node.js 20+`
2. `npm 10+`
3. `MySQL 8.x`

可选：

1. `Docker Desktop`
2. 可用的 SMTP 服务
3. 可访问公网的域名与 80/443 端口（仅 HTTPS 部署需要）

## 启动方式

### 本地开发

1. 安装依赖

```powershell
cd C:\Users\33981\Documents\MyProjects\Web\The-campus-market\client
npm install

cd ..\server
npm install

cd ..
npm install
```

2. 复制环境变量模板

```powershell
cd C:\Users\33981\Documents\MyProjects\Web\The-campus-market
copy .env.example .env
copy server\.env.example server\.env
```

3. 初始化数据库

```powershell
cd C:\Users\33981\Documents\MyProjects\Web\The-campus-market\server
cmd /c npm run init-db
cmd /c npm run doctor-db
```

4. 启动后端

```powershell
cd C:\Users\33981\Documents\MyProjects\Web\The-campus-market\server
cmd /c npm run dev
```

默认地址：

- `http://127.0.0.1:3000`

5. 启动前端

```powershell
cd C:\Users\33981\Documents\MyProjects\Web\The-campus-market\client
cmd /c npm run dev
```

默认地址：

- `http://127.0.0.1:5173`

### Docker 部署

根目录执行：

```powershell
cd C:\Users\33981\Documents\MyProjects\Web\The-campus-market
docker compose up -d --build
```

上线前建议先确认：

1. 根目录 `.env` 已按生产环境填写完整
2. 域名已解析到部署机器
3. `ENABLE_HTTPS=true` 时已开放 `80/443`
4. MySQL、上传目录、Nginx 反代相关卷路径正确

部署侧完整说明见：

- [生产配置说明](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\deploy\production-config.md)
- [健康检查与排障说明](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\deploy\health-troubleshooting.md)

## 环境变量

本项目同时提供两套模板：

- 根目录生产模板：[.env.example](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\.env.example)
- 后端本地模板：[server/.env.example](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\server\.env.example)

建议规则：

1. 本地裸跑优先看 `server/.env.example`
2. Docker / 生产部署优先看根目录 `.env.example`
3. 生产环境不要使用示例里的占位密钥

### 应用与域名

必须明确：

- `NODE_ENV`
- `PORT`
- `APP_BASE_URL`
- `APP_PRIMARY_DOMAIN`
- `DOMAINS`
- `ENABLE_HTTPS`
- `HTTP_PORT`
- `HTTPS_PORT`

用途：

1. 前后端生成绝对地址
2. Nginx 反向代理
3. HTTPS 证书申请与跳转

### 数据库

二选一：

1. 使用完整连接串
    - `DATABASE_URL`
2. 使用拆分变量
    - `MYSQL_HOST`
    - `MYSQL_PORT`
    - `MYSQL_USER`
    - `MYSQL_PASSWORD`
    - `MYSQL_DATABASE`
    - `MYSQL_CONNECTION_LIMIT`

注意：

1. Docker 编排默认也会使用 `MYSQL_ROOT_PASSWORD`
2. 新环境首次启动前，数据库必须可连接

### JWT 与管理员初始化

必须明确：

- `JWT_SECRET`
- `ADMIN_BOOTSTRAP_KEY`

要求：

1. `JWT_SECRET` 不能使用默认占位值
2. `ADMIN_BOOTSTRAP_KEY` 仅用于第一次管理员初始化
3. 这两个值都必须保存在安全位置，不应提交到仓库

### 邮件与验证码

相关变量：

- `EMAIL_PROVIDER`
- `EMAIL_CODE_SECRET`
- `EMAIL_CODE_TTL_SECONDS`
- `EMAIL_CODE_COOLDOWN_SECONDS`
- `EMAIL_SENDER_NAME`
- `EMAIL_FROM`
- `EMAIL_SMTP_HOST`
- `EMAIL_SMTP_PORT`
- `EMAIL_SMTP_SECURE`
- `EMAIL_SMTP_USER`
- `EMAIL_SMTP_PASS`
- `EMAIL_SMTP_REJECT_UNAUTHORIZED`
- `EMAIL_SMTP_TIMEOUT_MS`

说明：

1. 当前项目允许先不配置真实 SMTP
2. 未配置时可使用 `EMAIL_PROVIDER=console`
3. `console` 模式下验证码只会打印到后端日志，不会真正投递到邮箱

### 上传与静态访问

相关变量：

- `UPLOAD_DIR`
- `UPLOAD_PUBLIC_PREFIX`
- `UPLOAD_MAX_BODY_SIZE`

说明：

1. `UPLOAD_DIR` 必须是可写目录
2. `UPLOAD_PUBLIC_PREFIX` 默认应为 `/uploads`
3. 上传图片最终通过 `http(s)://域名/uploads/...` 访问

### HTTPS 与证书

相关变量：

- `LETSENCRYPT_EMAIL`
- `LETSENCRYPT_STAGING`

用途：

1. 首次申请证书
2. 自动续期
3. 证书问题排查

### 备份与回滚

相关变量：

- `BACKUP_ROOT_DIR`
- `BACKUP_RETENTION_DAYS`
- `RESTORE_STOP_APPLICATION`
- `RESTORE_STOP_SERVICES`
- `RELEASE_STATE_DIR`
- `RELEASE_ROLLBACK_SERVICES`

用途：

1. 生成数据库与上传目录备份
2. 恢复备份前自动停服务
3. 发布前记录镜像快照，支持回滚

## 数据库初始化与迁移

项目数据库初始化不是一次性 SQL，而是可重复执行的迁移式流程。

后端入口：

- [server/src/models/init.js](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\server\src\models\init.js)

### 相关命令

```powershell
cd C:\Users\33981\Documents\MyProjects\Web\The-campus-market\server
cmd /c npm run init-db
cmd /c npm run migrate-db
cmd /c npm run doctor-db
```

含义：

1. `init-db`
    - 兼容旧入口
    - 等价于执行当前迁移
2. `migrate-db`
    - 显式执行迁移
3. `doctor-db`
    - 自检表、列、索引是否完整

### 首次初始化顺序

```powershell
cd C:\Users\33981\Documents\MyProjects\Web\The-campus-market\server
cmd /c npm run doctor-env
cmd /c npm run init-db
cmd /c npm run doctor-db
```

然后再启动后端。

### 重复部署顺序

```powershell
cd C:\Users\33981\Documents\MyProjects\Web\The-campus-market\server
cmd /c npm run migrate-db
cmd /c npm run doctor-db
```

说明：

1. 迁移是幂等的
2. 已执行过的 migration 会跳过
3. 缺失列、索引会自动补齐

### 数据迁移顺序

迁移按 [server/src/models/init.js](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\server\src\models\init.js) 内的版本顺序执行，核心顺序可以理解为：

1. 用户与验证码表
2. 商品、帖子、评论、点赞
3. 消息、通知、实时事件
4. 收藏、好友、隐藏会话
5. 订单、评价
6. 举报、密码重置工单
7. 结构漂移修复与索引补齐

如果是从历史备份恢复到新版本，标准顺序是：

1. 恢复 MySQL 数据
2. 恢复上传目录
3. 执行 `npm run migrate-db`
4. 执行 `npm run doctor-db`
5. 再启动服务

## 管理员初始化流程

项目默认没有预置管理员。第一次需要手工提升一个普通用户。

后端接口：

- `POST /api/setup/bootstrap-admin`

对应实现：

- [server/src/routes/setup.js](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\server\src\routes\setup.js)

### 前置条件

1. 已有一个普通用户账号
2. 已登录并拿到 `token`
3. 已在 `.env` 或 `server/.env` 中配置 `ADMIN_BOOTSTRAP_KEY`
4. 系统中当前还没有任何管理员

### 请求头

- `Authorization: Bearer <token>`
- `x-bootstrap-key: <ADMIN_BOOTSTRAP_KEY>`

### 示例

```powershell
curl -X POST http://127.0.0.1:3000/api/setup/bootstrap-admin ^
  -H "Authorization: Bearer 你的登录token" ^
  -H "x-bootstrap-key: 你的ADMIN_BOOTSTRAP_KEY"
```

### 成功后的结果

当前账号会被提升为：

- `is_admin = 1`
- `can_moderate = 1`

### 失败时优先检查

1. 是否使用了正确接口 `/api/setup/bootstrap-admin`
2. `Authorization` 是否有效
3. `x-bootstrap-key` 是否与 `ADMIN_BOOTSTRAP_KEY` 一致
4. 系统里是否已经存在管理员

## build / doctor / smoke 执行方式

根目录已经提供统一命令入口。

### 单项命令

```powershell
cd C:\Users\33981\Documents\MyProjects\Web\The-campus-market
cmd /c npm run build:client
cmd /c npm run check:server:syntax
cmd /c npm run doctor:env
cmd /c npm run doctor:db
cmd /c npm run smoke:core
cmd /c npm run smoke:auth
cmd /c npm run test:integration
cmd /c npm run test:repeat-submit
cmd /c npm run smoke:page
cmd /c npm run smoke:concurrency
```

### 本地必跑集合

```powershell
cd C:\Users\33981\Documents\MyProjects\Web\The-campus-market
cmd /c npm run regress:local
```

执行顺序：

1. 前端构建
2. 后端语法检查
3. 环境检查
4. 数据库检查
5. 关键 smoke

### 全量验收集合

```powershell
cd C:\Users\33981\Documents\MyProjects\Web\The-campus-market
cmd /c npm run verify:all
```

执行顺序：

1. 前端构建
2. 后端语法检查
3. 环境检查
4. 数据库检查
5. 关键 smoke
6. 并发检查

### 关键 smoke 覆盖

`npm run smoke:critical` 当前覆盖：

1. 登录 / 注册 / 改密
2. 商品发布 / 编辑 / 收藏
3. 帖子发布 / 评论 / 点赞
4. 下单 / 完成 / 取消 / 评价
5. 私信 / 好友 / 通知
6. 举报 / 审核 / 找回密码处理

本地回归约定见：

- [local-regression.md](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\local-regression.md)

## 备份与恢复

备份与恢复脚本位于：

- [deploy/backup/create-backup.sh](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\deploy\backup\create-backup.sh)
- [deploy/backup/restore-backup.sh](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\deploy\backup\restore-backup.sh)

说明文档：

- [deploy/backup/backup-plan.md](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\deploy\backup\backup-plan.md)

### 备份命令

```bash
sh deploy/backup/create-backup.sh
```

备份产物至少包括：

1. `mysql.sql`
2. `uploads.tar.gz`
3. `manifest.txt`

### 恢复命令

```bash
sh deploy/backup/restore-backup.sh backups/<timestamp> --force
```

### 恢复后的标准顺序

1. 停止业务服务
2. 恢复数据库
3. 恢复上传目录
4. 执行迁移
5. 执行数据库自检
6. 启动业务服务

命令串建议：

```powershell
cd C:\Users\33981\Documents\MyProjects\Web\The-campus-market\server
cmd /c npm run migrate-db
cmd /c npm run doctor-db
```

如果是 Docker 环境，再拉起：

```powershell
cd C:\Users\33981\Documents\MyProjects\Web\The-campus-market
docker compose up -d
```

## 基础排障说明

详细说明见：

- [deploy/health-troubleshooting.md](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\deploy\health-troubleshooting.md)

这里保留最常用的排查入口。

### 先看健康状态

本地后端：

```powershell
curl http://127.0.0.1:3000/api/health
```

Docker 环境：

```powershell
docker compose ps
docker compose logs -f
curl http://127.0.0.1/nginx-health
```

环境与数据库自检：

```powershell
cd C:\Users\33981\Documents\MyProjects\Web\The-campus-market\server
cmd /c npm run doctor-env
cmd /c npm run doctor-db
```

### 服务启动失败

优先检查：

1. `server/.env` 或根目录 `.env` 是否缺变量
2. MySQL 是否已启动
3. `JWT_SECRET` 是否仍是占位值
4. `UPLOAD_DIR` 是否可写
5. 端口是否已被占用

### 数据库连接失败

优先检查：

1. `DATABASE_URL` 或 `MYSQL_*` 是否正确
2. 数据库用户是否有权限
3. 数据库名是否存在
4. MySQL 端口是否正确
5. 执行 `npm run init-db` 后是否报迁移错误

### 邮件发送失败

优先检查：

1. 当前是否仍在 `EMAIL_PROVIDER=console`
2. `EMAIL_SMTP_HOST / PORT / USER / PASS / FROM` 是否完整
3. SMTP 服务是否允许当前账号发信
4. 后端日志里是否有超时或认证失败

### 上传失败

优先检查：

1. `UPLOAD_DIR` 是否存在且可写
2. `UPLOAD_PUBLIC_PREFIX` 是否正确
3. Nginx 是否正确转发 `/uploads`
4. 是否触发了大小或格式限制

当前限制：

1. 单张最大 `5MB`
2. 单次最多 `9` 张
3. 仅允许 `JPG / JPEG / PNG / GIF / WebP`

### 回归脚本失败

先看是哪一步失败：

1. `build:client` 失败
    - 先修前端构建错误
2. `check:server:syntax` 失败
    - 先修后端语法错误
3. `doctor:env` 失败
    - 先修环境变量
4. `doctor:db` 失败
    - 先修数据库结构或连接
5. `smoke:*` 失败
    - 再看具体业务链路

### Docker 部署后站点打不开

优先检查这些容器：

1. `frontend`
2. `server1`
3. `server2`
4. `nginx`
5. `mysql`

建议命令：

```powershell
docker compose ps
docker compose logs -f nginx
docker compose logs -f server1
docker compose logs -f server2
docker compose logs -f mysql
```

## 补充文档

### 规范与治理

- [MD3 风格开发规范](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\md3-like-web-guidelines.md)
- [内容治理规则](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\content-governance.md)
- [数据隐私与可见范围](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\data-privacy.md)
- [后端日志与错误分级约定](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\backend-log-error-policy.md)

### 部署与运维

- [生产配置说明](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\deploy\production-config.md)
- [健康检查与排障说明](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\deploy\health-troubleshooting.md)
- [数据库备份与恢复说明](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\deploy\backup\backup-plan.md)
- [发布回滚方案](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\deploy\release\rollback-plan.md)
