# 发布回滚方案

本文档对应当前 Docker Compose 部署结构，目标是：

- 新版本异常时，先快速切回旧应用镜像
- 如果新版本还改坏了数据库或上传数据，再接数据恢复

## 1. 回滚前提

要做到快速回滚，发布前必须先执行一次发布快照：

```bash
sh deploy/release/prepare-release.sh
```

这一步会同时做两件事：

1. 调用备份脚本，生成一份发布前数据库和上传目录备份
2. 记录当前运行中的应用服务镜像 ID，生成回滚清单

产物位置：

```text
release-state/
    releases/
        20260602-120000/
            release.env
```

其中 `release.env` 会包含：

- 回滚服务列表
- 每个服务当前运行镜像的本地 image id
- 关联的备份目录

## 2. 快速回滚应用

如果新版本刚上线就出现页面异常、接口异常、实时消息异常，但数据库结构还没有被新版本破坏，优先走应用回滚：

```bash
sh deploy/release/rollback-release.sh release-state/releases/20260602-120000/release.env --force
```

效果：

- `frontend`
- `server1`
- `server2`
- `nginx`
- `certbot`

会直接按发布前的镜像 ID 重建，切回旧版本。

这个步骤不会恢复数据库，也不会覆盖上传文件，适合：

- 前端包有问题
- 后端新逻辑有问题
- Nginx 配置有问题
- WebSocket / 实时链路有问题

## 3. 数据回滚

如果新版本已经引入了不兼容的数据变更，例如：

- 写入了错误订单状态
- 批量改坏了商品状态
- 运行了不兼容的数据迁移
- 上传目录内容被覆盖

仅做应用回滚不够，还要接着恢复数据：

```bash
sh deploy/backup/restore-backup.sh backups/20260602-120000 --force
```

恢复来源优先使用 `release.env` 里记录的 `BACKUP_DIR`。

## 4. 推荐回滚顺序

### 场景 A：代码问题，数据没坏

1. 执行应用回滚
2. 检查服务健康
3. 检查首页、登录、订单、消息、举报后台

### 场景 B：代码问题 + 数据已写坏

1. 先执行应用回滚
2. 再执行数据库和上传恢复
3. 再检查服务和业务数据

原因：

- 先切回旧程序，避免恢复期间新版本继续写坏数据

## 5. 恢复后检查

至少检查这些：

1. 服务状态

```bash
docker compose ps
```

2. 健康检查

```bash
curl http://127.0.0.1:${HTTP_PORT:-80}/api/health
```

3. 关键功能

- 登录
- 商品列表和商品详情
- 帖子详情
- 下单与订单列表
- 消息列表
- 举报管理页
- 上传图片访问

## 6. 相关脚本

- 发布前快照
    - [prepare-release.sh](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\deploy\release\prepare-release.sh)
- 应用回滚
    - [rollback-release.sh](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\deploy\release\rollback-release.sh)
- 数据备份与恢复
    - [backup-plan.md](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\deploy\backup\backup-plan.md)

## 7. 相关配置

建议加入根目录 `.env`：

```env
RELEASE_STATE_DIR=./release-state
RELEASE_ROLLBACK_SERVICES=frontend server1 server2 nginx certbot
```

## 8. 边界说明

当前回滚方案的核心前提是：

- 发布前已经执行了 `prepare-release.sh`
- 本地旧镜像还没有被清理
- Docker 主机还保留这些 image id

如果你在发布后立刻执行了镜像清理，例如 `docker image prune -a`，旧镜像可能会被删掉，应用快速回滚就会失效。

所以运维约束应当是：

- 至少保留最近一版发布快照对应的镜像
- 在确认新版本稳定前，不要清理旧镜像
