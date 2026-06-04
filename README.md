# The-campus-market

校园二手交易与校园圈项目，前后端分离，后端使用 Node.js + Express + MySQL，前端使用 Vue 3 + Vite。

## 项目功能

当前已经覆盖的核心功能：

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
    - 上架 / 下架 / 标记售出 / 删除
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
7. 运维与交付
    - MySQL 迁移式初始化
    - 本地回归脚本
    - Docker / Nginx / HTTPS 部署基座
    - 数据备份与恢复脚本

## 目录结构

```text
client/          前端项目
server/          后端项目
deploy/          部署、备份、回滚、排障文档与脚本
docker-compose.yml
package.json     根目录统一命令入口
```

## 环境要求

本地开发至少需要：

1. Node.js 20+
2. npm 10+
3. MySQL 8.x

可选：

1. Docker Desktop
2. 真实 SMTP 服务

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

2. 准备环境变量

```powershell
copy .env.example .env
copy server\.env.example server\.env
```

优先保证这些变量正确：

1. `DATABASE_URL` 或 `MYSQL_HOST / MYSQL_PORT / MYSQL_USER / MYSQL_PASSWORD / MYSQL_DATABASE`
2. `JWT_SECRET`
3. `ADMIN_BOOTSTRAP_KEY`
4. `UPLOAD_DIR`

3. 初始化数据库

```powershell
cd C:\Users\33981\Documents\MyProjects\Web\The-campus-market\server
cmd /c npm run init-db
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

### 一键本地检查

根目录已经有统一校验脚本入口：

```powershell
cd C:\Users\33981\Documents\MyProjects\Web\The-campus-market
cmd /c npm run regress:local
```

### Docker 部署

根目录执行：

```powershell
cd C:\Users\33981\Documents\MyProjects\Web\The-campus-market
docker compose up -d --build
```

部署相关完整说明见：

- [生产配置说明](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\deploy\production-config.md)
- [健康检查与排障说明](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\deploy\health-troubleshooting.md)

## 数据库初始化

项目数据库初始化是可重复执行的迁移式流程，不是一次性建表脚本。

常用命令：

```powershell
cd C:\Users\33981\Documents\MyProjects\Web\The-campus-market\server
cmd /c npm run init-db
cmd /c npm run migrate-db
cmd /c npm run doctor-db
```

说明：

1. `init-db`
    - 兼容旧入口
    - 等价于执行当前迁移
2. `migrate-db`
    - 显式迁移命令
3. `doctor-db`
    - 检查表、列、索引是否完整

推荐顺序：

1. 先配置数据库环境变量
2. 执行 `npm run init-db`
3. 执行 `npm run doctor-db`
4. 再启动后端服务

## 回归检查

### 改完代码必须跑

```powershell
cd C:\Users\33981\Documents\MyProjects\Web\The-campus-market
cmd /c npm run regress:local
```

它会通过根目录脚本 `scripts/verify.mjs` 顺序执行：

1. 前端生产构建
2. 后端环境自检
3. 数据库结构自检
4. 关键业务回归

### 上线前建议再跑

```powershell
cd C:\Users\33981\Documents\MyProjects\Web\The-campus-market
cmd /c npm run regress:full
```

或直接：

```powershell
cmd /c npm run verify:all
```

这同样通过根目录统一校验脚本执行，并额外覆盖：

1. 页面访问冒烟
2. 并发验证

### 单项检查命令

```powershell
cmd /c npm run smoke:core
cmd /c npm run smoke:auth
cmd /c npm run test:integration
cmd /c npm run test:repeat-submit
cmd /c npm run smoke:page
cmd /c npm run smoke:concurrency
```

本地回归约定见：

- [local-regression.md](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\local-regression.md)

## 管理员初始化

项目默认没有预置管理员账号，第一次需要手动初始化。

### 前置条件

1. 已有普通用户账号
2. 已登录，拿到登录 token
3. `.env` 或 `server/.env` 中已配置 `ADMIN_BOOTSTRAP_KEY`

### 接口

- `POST /api/setup/bootstrap-admin`

### 请求方式

请求头带：

- `Authorization: Bearer <token>`
- `x-bootstrap-key: <ADMIN_BOOTSTRAP_KEY>`

示例：

```powershell
curl -X POST http://127.0.0.1:3000/api/setup/bootstrap-admin ^
  -H "Authorization: Bearer 你的登录token" ^
  -H "x-bootstrap-key: 你的ADMIN_BOOTSTRAP_KEY"
```

说明：

1. 该接口只能成功一次
2. 系统里已有管理员后，再次初始化会被拒绝
3. 成功后当前账号会被提升为：
    - `is_admin = 1`
    - `can_moderate = 1`

## 常见问题

### 1. 后端启动失败

优先检查：

```powershell
cd C:\Users\33981\Documents\MyProjects\Web\The-campus-market\server
cmd /c npm run doctor-env
cmd /c npm run doctor-db
```

再看：

1. MySQL 是否已启动
2. `DATABASE_URL` 或 `MYSQL_*` 是否正确
3. `JWT_SECRET` 是否已配置

### 2. 数据库连接失败

常见原因：

1. MySQL 没启动
2. 用户名或密码错误
3. 数据库名不存在
4. 端口不是 `3306`

建议先手工验证 MySQL 连接，再执行：

```powershell
cmd /c npm run init-db
cmd /c npm run doctor-db
```

### 3. 注册验证码接口成功，但邮箱没收到

当前默认配置通常是：

- `EMAIL_PROVIDER=console`

这表示：

1. 接口能成功
2. 验证码只会打印到后端日志
3. 不会真的发到邮箱

要真实发信，需要补全 SMTP 配置。

### 4. 图片上传失败

已限制：

1. 单张最大 `5MB`
2. 单次最多 `9` 张
3. 仅允许 `JPG / JPEG / PNG / GIF / WebP`

还要检查：

1. `UPLOAD_DIR` 是否存在且可写
2. `UPLOAD_PUBLIC_PREFIX` 是否正确
3. Nginx 是否正确转发 `/uploads`

### 5. 管理员初始化失败

优先检查：

1. 是否用了正确接口 `/api/setup/bootstrap-admin`
2. 是否已登录
3. `x-bootstrap-key` 是否和 `ADMIN_BOOTSTRAP_KEY` 一致
4. 系统里是否已经存在管理员

### 6. 回归脚本失败

优先判断失败类型：

1. `build:client` 失败
    - 先修前端构建
2. `doctor:env` 失败
    - 先修环境变量
3. `doctor:db` 失败
    - 先修数据库结构
4. `smoke:*` 失败
    - 再看具体业务链路

### 7. Docker 启动后站点打不开

先看：

```powershell
docker compose ps
docker compose logs -f
```

再重点检查：

1. `frontend`
2. `server1`
3. `server2`
4. `nginx`
5. `mysql`

## 补充文档

### 规则与治理

- [MD3 风格开发规范](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\md3-like-web-guidelines.md)
- [内容治理规则](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\content-governance.md)
- [数据隐私与可见范围](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\data-privacy.md)
- [后端日志与错误分级约定](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\backend-log-error-policy.md)

### 部署与运维

- [生产配置说明](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\deploy\production-config.md)
- [健康检查与排障说明](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\deploy\health-troubleshooting.md)
- [数据库备份与恢复说明](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\deploy\backup\backup-plan.md)
- [发布回滚方案](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\deploy\release\rollback-plan.md)
