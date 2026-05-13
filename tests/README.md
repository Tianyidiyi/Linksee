# tests

统一测试目录（仓库根目录）：

- `tests/unit/**`：纯单元测试，不依赖数据库与外部服务
- `tests/integration/**`：集成测试，可依赖数据库/Redis/MinIO

当前由 `apps/api/jest.config.js` 统一消费本目录测试用例。
