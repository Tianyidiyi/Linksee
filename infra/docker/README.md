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

## 5. 安全注意事项

### 5.1 .env 文件不得提交到 Git

- `.env` 含真实密码，必须在 `.gitignore` 中排除。
- `.env.example` 是唯一可提交的模板，所有值都用占位符。
- 团队成员启动前执行：`Copy-Item .env.example .env` 然后自行填写真实值。

### 5.2 JWT_SECRET 生成要求

- 长度至少 32 字节（256 bits），用随机字符串，不要用项目名、日期等可猜测值。
- PowerShell 生成示例：
  ```powershell
  -join ((65..90)+(97..122)+(48..57) | Get-Random -Count 48 | ForEach-Object {[char]$_})
  ```

### 5.3 Argon2 是 native 模块，Docker 内需重新编译

`argon2` npm 包含 C++ 扩展，在 Docker 容器（Linux）内运行时需要在容器内安装，
不能直接把 Windows 环境的 node_modules 挂载进去。
Dockerfile 中必须执行 `npm install`（或 `npm ci`），不能只 COPY node_modules。

### 5.4 Redis 限流 Key 命名规范

登录暴力破解防护使用 Redis 计数器，Key 格式：
- `rate:login:ip:{ip}`   → 同一 IP 连续失败计数，TTL 15 分钟
- `rate:login:user:{username}` → 同一账号连续失败计数，TTL 15 分钟
超过 5 次后接口直接返回 429，不再验证密码。

### 5.5 MySQL init 脚本执行顺序

`mysql-init/` 目录下脚本按文件名字典序执行：

| 文件 | 内容 |
|------|------|
| `001_create_extensions.sql` | 占位/扩展预留 |
| `002_auth_tables.sql` | 用户、令牌、审计表 |

**注意**：init 脚本只在容器首次初始化（数据卷为空）时执行。
已有数据时重新 `down -v up` 才会重跑，否则用 Prisma migration。

### 5.6 端口绑定（生产环境）

当前 docker-compose 将所有端口绑定到 `0.0.0.0`（即对外可达），开发环境可接受。
生产/测试环境部署时：
- MySQL (3306)、Redis (6379)、MinIO API (9000) 改为绑定 `127.0.0.1`，只允许本机访问。
- 只有 API 服务（Node.js，如 3000 端口）通过反向代理对外暴露。

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
