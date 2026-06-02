# 数据备份与恢复

本文档对应当前 Docker Compose 生产部署方案，覆盖：

- MySQL 数据备份
- 上传文件备份
- 恢复步骤
- 日常执行建议

## 1. 备份范围

必须备份以下两类数据：

- MySQL 业务库
    - 订单、商品、帖子、消息、举报、通知、用户资料都在库里
- 上传文件
    - 商品图、帖子图、头像等都在 `server_uploads` 卷里

不建议只备份数据库，不备份上传目录。否则恢复后会出现数据记录存在，但图片资源丢失的问题。

## 2. 现成脚本

- 创建备份
    - [create-backup.sh](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\deploy\backup\create-backup.sh)
- 恢复备份
    - [restore-backup.sh](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\deploy\backup\restore-backup.sh)

脚本默认基于根目录 `docker-compose.yml` 执行，并自动读取根目录 `.env`。

## 3. 备份目录结构

每次备份会生成一个时间戳目录，例如：

```text
backups/
    20260602-120000/
        mysql.sql
        uploads.tar.gz
        manifest.txt
```

说明：

- `mysql.sql`
    - 使用 `mysqldump` 导出的全量数据库 SQL
- `uploads.tar.gz`
    - 当前 `/app/uploads` 目录完整打包
- `manifest.txt`
    - 记录备份时间和来源服务

## 4. 创建备份

在项目根目录执行：

```bash
sh deploy/backup/create-backup.sh
```

执行结果：

- 导出 MySQL 数据到 `backups/<timestamp>/mysql.sql`
- 导出上传目录到 `backups/<timestamp>/uploads.tar.gz`
- 按 `BACKUP_RETENTION_DAYS` 自动清理过期备份目录

## 5. 恢复前要求

恢复是高风险操作，必须先满足这些前提：

1. 确认恢复窗口
    - 恢复期间不要继续写入新订单、新消息、新上传
2. 先做一次当前现场备份
    - 不要在没有二次备份的情况下直接覆盖线上数据
3. 明确恢复来源
    - 必须知道要恢复哪个时间点的备份目录

## 6. 恢复步骤

执行：

```bash
sh deploy/backup/restore-backup.sh backups/20260602-120000 --force
```

脚本行为：

1. 启动 `mysql`
2. 停止 `nginx frontend server1 server2`
3. 用 `mysql.sql` 覆盖恢复数据库
4. 清空现有上传目录内容
5. 用 `uploads.tar.gz` 恢复上传文件
6. 自动重新启动已停止的应用服务

说明：

- 恢复脚本会覆盖数据库内容
- 恢复脚本会清空当前上传目录后再解压备份
- 所以必须先做现场备份，再做恢复

## 7. 恢复后检查

恢复完成后至少检查这些：

1. 服务状态

```bash
docker compose ps
```

2. 后端健康检查

```bash
curl http://127.0.0.1:${HTTP_PORT:-80}/api/health
```

3. 核心页面与资源

- 首页是否正常
- 商品详情图片是否正常显示
- 帖子图片是否正常显示
- 消息、订单、举报后台是否正常打开

4. 核心业务抽查

- 登录
- 查看订单
- 查看消息
- 查看商品图
- 查看帖子图

## 8. 建议频率

最低建议：

- 数据库：每天至少 1 次全量备份
- 上传目录：每天至少 1 次全量备份

如果业务活跃，建议：

- 每 6 小时 1 次全量备份
- 大促或高峰期额外加密集备份

## 9. 定时任务示例

Linux `cron` 示例，每天凌晨 3 点执行：

```cron
0 3 * * * cd /srv/the-campus-market && /bin/sh deploy/backup/create-backup.sh >> /var/log/the-campus-market-backup.log 2>&1
```

## 10. 相关配置项

建议放在根目录 `.env`：

```env
BACKUP_ROOT_DIR=./backups
BACKUP_RETENTION_DAYS=7
RESTORE_STOP_APPLICATION=true
RESTORE_STOP_SERVICES=nginx frontend server1 server2
```

## 11. 边界说明

当前这套方案是：

- 全量备份
- 基于 Docker Compose
- 适合当前单库单上传卷部署

还没有做：

- 增量备份
- 异地备份
- 自动上传对象存储
- 自动恢复演练

这些如果要补，下一步应该直接做“备份产物同步到 OSS / S3”。
