# 数据库备份与恢复说明

本文档只聚焦数据库和上传目录的备份、恢复、初始化顺序与迁移顺序。

适用范围：

1. 当前 `docker-compose.yml` 的生产部署方案
2. MySQL 业务库
3. `server_uploads` 上传卷

## 备份范围

必须同时备份两类数据：

1. MySQL 业务库
2. 上传文件目录

原因：

1. 只备份数据库，不备份上传目录，恢复后会出现商品、帖子、头像记录存在，但图片文件丢失
2. 只备份上传目录，不备份数据库，恢复后文件无法和业务记录对应

## 现有脚本

备份脚本：

1. [create-backup.sh](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\deploy\backup\create-backup.sh)

恢复脚本：

1. [restore-backup.sh](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\deploy\backup\restore-backup.sh)

相关数据库迁移命令：

1. [server/package.json](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\server\package.json)
2. `npm run migrate-db`
3. `npm run init-db`
4. `npm run doctor-db`

## 备份命令

在项目根目录执行：

```bash
sh deploy/backup/create-backup.sh
```

默认产物结构：

```text
backups/
    20260604-120000/
        mysql.sql
        uploads.tar.gz
        manifest.txt
```

各文件含义：

1. `mysql.sql`
   当前 MySQL 全量导出
2. `uploads.tar.gz`
   当前 `/app/uploads` 全量打包
3. `manifest.txt`
   记录时间戳、来源服务和备份目录

## 恢复命令

在项目根目录执行：

```bash
sh deploy/backup/restore-backup.sh backups/20260604-120000 --force
```

恢复脚本会做这些事：

1. 启动 `mysql`
2. 停止 `nginx frontend server1 server2`
3. 用 `mysql.sql` 覆盖恢复数据库
4. 清空当前上传目录
5. 解压 `uploads.tar.gz`
6. 重新拉起被停止的应用服务

## 初始化顺序

### 首次部署

首次部署建议按这个顺序：

1. 准备根目录 `.env`
2. 启动基础服务

```bash
docker compose up -d mysql
```

3. 执行数据库迁移

```bash
cd server
npm run migrate-db
```

4. 做数据库结构自检

```bash
npm run doctor-db
```

5. 再启动全部服务

```bash
cd ..
docker compose up -d --build
```

### 重复部署

重复部署不要手改表结构，统一按下面顺序：

1. 更新代码
2. 执行迁移

```bash
cd server
npm run migrate-db
```

3. 执行自检

```bash
npm run doctor-db
```

4. 再重启或发布应用

### 从备份恢复到新环境

从旧备份恢复到一台新机器时，顺序必须是：

1. 准备 `.env`
2. 启动 `mysql`
3. 执行恢复脚本
4. 恢复完成后再执行一次迁移

```bash
cd server
npm run migrate-db
```

5. 再执行一次结构自检

```bash
npm run doctor-db
```

6. 最后启动全部服务

原因：

1. 备份里的 `mysql.sql` 代表某个历史时间点的库结构
2. 新代码可能已经新增迁移
3. 恢复后必须再跑一次迁移，补齐备份快照之后的新列、新索引、新表

## 数据迁移顺序

数据库迁移顺序以 [init.js](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\server\src\models\init.js) 中的 `migrations` 数组为准，当前顺序是：

1. `20260602_001_base_tables`
2. `20260602_002_users_upgrade`
3. `20260602_002_verification_codes_upgrade`
4. `20260602_003_products_upgrade`
5. `20260602_004_posts_social_upgrade`
6. `20260602_005_message_and_notification_upgrade`
7. `20260602_006_relation_upgrade`
8. `20260602_007_order_review_upgrade`
9. `20260602_008_report_and_reset_upgrade`
10. `20260602_009_realtime_events_upgrade`
11. `20260602_010_schema_drift_fix`

执行规则：

1. `schema_migrations` 记录已执行版本
2. `npm run migrate-db` 会按顺序跳过已执行版本
3. 新迁移必须追加，不要插队改旧版本号
4. 恢复历史备份后，也按同一顺序补齐缺失迁移

## 恢复后的检查顺序

恢复完成后，至少检查这些项：

1. 数据库迁移是否补齐

```bash
cd server
npm run doctor-db
```

2. 服务健康检查

```bash
curl http://127.0.0.1:3000/api/health
```

3. 上传目录是否可访问
4. 首页、商品详情、帖子详情是否能打开
5. 登录、消息、订单、举报后台是否能正常读取历史数据

## 运维建议

最低建议：

1. 每天至少一次全量备份
2. 每次发布前额外做一次备份
3. 每次恢复后都执行 `migrate-db + doctor-db`

不要做的事：

1. 不要手工改表后再跳过迁移
2. 不要只恢复数据库不恢复上传目录
3. 不要恢复历史备份后直接启动新版本而不补迁移
