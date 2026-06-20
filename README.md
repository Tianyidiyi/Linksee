# Linksee

Linksee 是面向高校课程项目、小组作业、实训课程和毕业设计过程管理的教学协作平台。

它不是普通作业提交系统，也不是通用团队协作平台。Linksee 聚焦一条主线：

> 老师发布阶段要求 -> 学生小组协作 -> 小组提交成果 -> 老师查看过程并反馈评分。

一句话定位：

> Linksee 让学生协作有空间，让老师评价有依据。

## 核心术语

| 术语       | 含义                           | P0 定位          |
| ---------- | ------------------------------ | ---------------- |
| Course     | 课程空间，例如“软件工程”     | 必做             |
| Class      | 课程下的班级或学生名单范围     | 可用简化名单代替 |
| Assignment | 老师发布的课程项目             | 必做             |
| Stage      | Assignment 下的阶段要求        | 必做             |
| Group      | 学生围绕 Assignment 形成的小组 | 必做             |
| MiniTask   | 小组内部拆分的执行任务         | P0-B 补充        |
| Submission | 小组针对 Stage 的成果提交      | 必做             |
| Review     | 老师或助教对 Submission 的反馈 | 必做             |
| Grade      | 阶段分数或最终成绩             | P0-B 补充        |

P0 不单独实现老师层 `Task` 实体。老师发布的阶段要求统一建模为 `Stage`，学生小组内部任务统一建模为 `MiniTask`。

## 仓库结构

- [apps](apps/)：前端、后端、异步 Worker
- [docs](docs/)：产品、架构、接口和计划文档
- [tests](tests/)：测试分层
- [infra](infra/)：Docker、CI/CD、部署相关配置
- [scripts](scripts/)：自动化脚本

## 文档入口

- [文档导航](docs/README.md)
- [教学协作产品概述](docs/product/教学协作产品概述.md)
- [课程场景与需求](docs/product/课程场景与需求.md)
- [MVP任务与后续计划](docs/product/MVP任务与后续计划.md)
- [两个月团队计划](docs/product/两个月团队计划.md)
- [架构文档说明](docs/architecture/架构文档说明.md)
- [通信架构设计](docs/architecture/通信架构设计.md)
- [通信治理规范](docs/architecture/通信治理规范.md)
- [通信契约](docs/api/contracts/通信契约.md)
- [工程流程与构建说明](docs/architecture/工程流程与构建说明.md)
- [参考资料目录](docs/参考资料/)

## 本地命令

```bash
npm install
npm run build
npm run start:auth -w @linksee/api
```

Docker 依赖：

```bash
npm run dev:deps:up
npm run dev:deps:down
```

更多说明见 [构建打包流程](infra/ci-cd/build-package-flow.md) 和 [新人安装步骤与日常命令清单](docs/architecture/首次安装步骤与日常命令清单.md)。

## 协作约定

- 产品先行：先明确课程场景、用户角色和评分流程。
- API 先契约：先更新接口契约，再并行开发。
- 小步交付：每个 Sprint 完成一条可演示链路。
- 质量门禁：构建、关键接口测试和最小端到端流程必须可验证。
- 数据可追溯：提交、反馈、评分和互评都要保留记录。

工程 Skills 入口：[skills](skills/)，使用流程见 [skills/USAGE-FLOW.md](skills/USAGE-FLOW.md)。
