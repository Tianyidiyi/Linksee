# 工程流程（客户端/服务端/测试/构建/打包）

## 1. Web 应用是否区分客户端和服务端

必须区分。

- 客户端（apps/web）：页面渲染、状态管理、Socket 订阅
- 服务端（apps/api）：认证授权、业务处理、数据持久化、事件分发

不区分会导致权限、日志、故障定位混乱。

## 2. 初期是否需要考虑测试、构建、打包

必须在初期就定最小流程，否则中后期返工成本高。

## 3. 最小开发流程

1. 需求评审：先写通信决策表。
2. 契约先行：更新 docs/api/communication-contract-v1.md。
3. 后端实现：HTTP -> 业务 -> 事件发布。
4. 前端实现：HTTP 调用 + Socket 订阅。
5. 测试：unit + integration + 最小 e2e。
6. 打包：web 静态产物 + api 服务镜像。

## 4. 如何在电脑上测试

### 4.1 本地联调最小集

- 启动数据库（MySQL）
- 启动缓存（Redis）
- 启动 api
- 启动 web

### 4.2 验证顺序

1. HTTP 写接口成功。
2. Socket 可收到变化推送。
3. 断开 Socket 后，页面可通过拉取恢复状态。

## 5. 构建与打包建议

### 5.1 web

- 产出静态资源（dist）
- 由 Nginx 或静态托管服务承载

### 5.2 api

- 产出可运行服务（Node）
- 使用 Docker 镜像封装

### 5.3 worker

- 独立进程与独立镜像
- 与 api 解耦部署

## 6. MVP 阶段质量门禁

- 接口契约已更新
- 关键链路集成测试通过

---

## 7. 三阶段开发规范（本地 → 混合 → 全容器）

### 阶段一：本地开发（当前阶段）

**目标**：API 能跑起来，接口能通，不管容器化。

运行方式：

```
基础设施（MySQL / Redis / MinIO）  →  Docker 容器（docker-compose.dev.yml）
API 服务（apps/api）               →  本地 Node.js 进程（npm run dev）
Web 前端（apps/web）               →  本地 Vite 开发服务器（npm run dev）
```

连接方式：API 通过 `localhost:3306` / `localhost:6379` / `localhost:9000` 直接访问容器暴露的端口，无需额外配置。

日常命令：

```powershell
# 1. 启动基础设施
docker compose -f infra/docker/docker-compose.dev.yml --env-file infra/docker/.env up -d

# 2. 启动 API（新开终端）
cd apps/api && npm run dev

# 3. 启动 Web（新开终端）
cd apps/web && npm run dev
```

进入阶段二的条件：某个功能模块（如 auth）接口全部本地测试通过。

---

### 阶段二：混合模式（本地 API + 容器基础设施）

**目标**：验证 API 在 Linux 容器内能正常编译和运行（尤其是 argon2 native 模块）。

运行方式：

```
基础设施（MySQL / Redis / MinIO）  →  Docker 容器
API 服务（apps/api）               →  Docker 容器（新增 api service）
Web 前端（apps/web）               →  本地或容器均可
```

此阶段需要为 apps/api 编写 Dockerfile，并在 docker-compose 中新增 api 服务。

Dockerfile 关键要点（防止 argon2 编译失败）：

```dockerfile
FROM node:20-alpine
RUN apk add --no-cache python3 make g++   # native 模块编译依赖
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci                                 # 在容器内重新编译 .node 文件
COPY . .
CMD ["node", "dist/index.js"]
```

docker-compose 挂载规则：**不能**把 Windows 本地的 `node_modules` 挂载进容器，需用匿名卷隔离：

```yaml
volumes:
  - ./apps/api:/app          # 源码挂载（热更新）
  - /app/node_modules        # 匿名卷，保留容器内编译的 native 模块
```

进入阶段三的条件：所有功能模块完成，准备交付演示。

---

### 阶段三：全容器化（交付/演示）

**目标**：一条命令启动整套系统，消除机器差异。

```powershell
docker compose -f infra/docker/docker-compose.dev.yml up -d
# 所有服务（基础设施 + API + Web）均在容器内运行
```

此阶段对应 infra/ci-cd/ 下的构建流水线。

---

### 混合模式端口关系速查

| 服务 | 运行位置 | 访问地址 |
|------|---------|--------|
| MySQL | 容器 | localhost:3306 |
| Redis | 容器 | localhost:6379 |
| MinIO API | 容器 | localhost:9000 |
| MinIO Console | 容器 | localhost:9001 |
| apps/api | 本地 Node | localhost:3000（或自定义）|
| apps/web | 本地 Vite | localhost:5173（Vite 默认）|
- 发布前冒烟测试通过
- 回滚说明明确
