# Docker 本地开发基座

这个目录提供本地开发环境依赖，不需要云服务器即可运行：

- MySQL 8.0（业务主数据库）
- Redis 7（缓存、会话、限流、消息中转）
- MinIO（对象存储，存头像和文档）

## 1. 本地启动步骤

1. 安装 Docker Desktop。
2. 在本目录复制环境变量模板：
   - Windows PowerShell: Copy-Item .env.example .env
3. 修改 .env 中的密码。
4. 启动容器：
   - docker compose -f docker-compose.dev.yml --env-file .env up -d
5. 查看容器状态：
   - docker compose -f docker-compose.dev.yml ps

## 2. 访问入口

- MySQL: localhost:3306
- Redis: localhost:6379
- MinIO API: http://localhost:9000
- MinIO Console: http://localhost:9001

## 3. 停止与清理

- 停止：docker compose -f docker-compose.dev.yml down
- 连同数据卷删除：docker compose -f docker-compose.dev.yml down -v

## 4. 头像应该存在哪里

推荐不要把头像二进制直接存入 MySQL。

建议：

1. 文件内容存对象存储（MinIO/S3）。
2. MySQL 只存头像 URL、bucket、object_key、版本号。
3. 更新头像时先上传新对象，再更新数据库记录。

## 5. Worker 与 Redis 的定位

- Worker：异步执行慢任务（如图片压缩、文档切片、向量化、邮件推送）。
- Redis：
  - 缓存热点数据
  - 保存会话或验证码
  - 做限流计数
  - 做任务队列中间层（例如 BullMQ）

## 6. 是否需要云

- 开发阶段：不需要云，本地 Docker 足够。
- 联调/演示阶段：可以先用一台公网机器（IP 访问）不买域名。
- 正式上线：建议再加域名 + HTTPS + 监控告警。
