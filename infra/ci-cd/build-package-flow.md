# 构建与打包流程（MVP 最小可跑通版）

## 1. 本地前置

- Node.js 18+
- npm 9+
- Docker Desktop（可选，用于依赖容器）

## 2. 构建命令

在仓库根目录执行：

- npm run build

预期结果：

- [apps/api/dist/BUILD_INFO.json](../../apps/api/dist/BUILD_INFO.json)
- [apps/web/dist/BUILD_INFO.json](../../apps/web/dist/BUILD_INFO.json)
- [apps/worker/dist/BUILD_INFO.json](../../apps/worker/dist/BUILD_INFO.json)

## 3. 打包命令

在仓库根目录执行：

- npm run pack:apps

预期结果：

- 当前 workspace 包名：`@linksee/api`、`@linksee/web`、`@linksee/worker`
- 产品对外名称与包名统一为 Linksee；若后续重命名 package，需要同步更新根 [package.json](../../package.json) 与各应用 package.json

## 4. 一键验证

- npm run verify:build

用于 CI 的最小门禁：构建必须成功 + 打包必须成功。

## 5. 依赖服务（可选）

- npm run dev:deps:up
- npm run dev:deps:down

说明：依赖服务来自 [infra/docker/docker-compose.dev.yml](../docker/docker-compose.dev.yml)。
