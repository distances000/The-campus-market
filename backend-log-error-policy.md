# 后端日志与错误分级约定

## 目标

统一后端两件事：

1. 哪些属于业务错误
2. 哪些属于系统错误

默认要求：

1. 业务错误要返回可理解的中文提示
2. 系统错误不能把内部异常细节直接暴露给用户
3. 日志必须带 `request_id`
4. 同一类错误要有稳定的日志级别和事件名

## 错误分级

### 业务错误

业务错误指请求到达系统后，系统能理解请求，但因为业务规则不满足而拒绝处理。

典型场景：

1. 参数为空、格式不合法、ID 不合法
2. 未登录、无权限、越权访问
3. 资源不存在
4. 重复提交、重复点赞、重复收藏、重复举报
5. 非法状态流转
6. 当前订单、商品、工单状态不允许执行该操作

处理规则：

1. 使用 `AppError` / `createAppError(...)`
2. `kind=business`
3. 返回明确中文提示
4. 默认记录为 `warn`
5. 前端可以直接展示返回的 `message`

### 系统错误

系统错误指请求本身可能是正常的，但系统内部能力失败，导致无法完成处理。

典型场景：

1. 数据库连接失败、事务失败、锁等待异常
2. 文件系统、上传、静态资源写入失败
3. SMTP、第三方服务、网络调用失败
4. 未预期异常、空指针、代码 bug
5. 配置缺失、运行时依赖异常

处理规则：

1. 非 `AppError` 默认按系统错误处理
2. 必要时显式使用 `createSystemError(...)`
3. 返回统一兜底提示，如 `服务暂时不可用，请稍后再试`
4. 默认记录为 `error`
5. 日志中保留堆栈，接口响应中不暴露堆栈

## 当前实现约定

公共错误工具：

1. [error.js](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\server\src\utils\error.js)
2. [logger.js](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\server\src\utils\logger.js)

全局错误处理中间件：

1. [index.js](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\server\src\index.js)

统一规则：

1. `AppError` 默认视为业务错误
2. 非 `AppError` 默认视为系统错误
3. 接口响应会带 `error_type`
4. `error_type=business` 代表可预期业务拒绝
5. `error_type=system` 代表内部处理失败

## 日志级别约定

### `info`

用于正常业务完成和生命周期事件。

典型事件：

1. `server.started`
2. `auth.login_succeeded`
3. `order.created`
4. `moderation.report_updated`

### `warn`

用于业务错误、预期拒绝、风控边界。

典型事件：

1. `http.business_error`
2. `auth.login_failed`
3. `order.complete_failed`
4. 重复提交、越权访问、非法状态流转

### `error`

用于系统错误和需要排查的异常。

典型事件：

1. `http.system_error`
2. `server.bootstrap_failed`
3. 上传、数据库、邮件、实时通道异常

## 路由实现要求

新增或修改接口时，遵守下面口径：

1. 能预期的拒绝分支，用 `createAppError(...)` 或直接返回明确业务提示
2. 不要把数据库报错、堆栈、SQL、驱动原始文本直接返回给前端
3. 需要统一兜底时，让异常进入全局错误处理中间件
4. 记录日志时，优先带上：
   - `request_id`
   - `user_id`
   - `target_id`
   - `order_id`
   - `report_id`
   - `reason`

## 本地检查

改动错误处理或日志逻辑后，至少执行：

```powershell
npm run regress:local
```
