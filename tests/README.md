# tests

统一测试目录（仓库根目录）：

- `tests/unit/**`：纯单元测试，不依赖数据库与外部服务
- `tests/integration/**`：集成测试，可依赖数据库/Redis/MinIO
- `tests/e2e/**`：端到端测试，验证前端真实交互主链路

当前由 `apps/api/jest.config.js` 统一消费本目录测试用例。

注意：

- `npm test -w @linksee/api` 默认主要覆盖单元测试。
- 集成测试请使用 `npm run test:integration -w @linksee/api`。

建议阅读顺序：

1. [集成测试目录说明](integration/README.md)
2. [集成测试场景清单](integration/集成测试场景清单.md)
3. [端到端测试说明](e2e/README.md)
