# 当前架构状态（2026-04-27）

## 1. 产品方向调整

项目已从通用“云端团队协作平台”调整为：

> Linksee 教学项目协作与过程评价平台

新的核心场景是高校课程项目、小组作业、实训课程和毕业设计过程管理。平台重点支持老师实时追踪小组进度、学生阶段提交、教师反馈、自动测试、互评和 Rubric 评分。

产品大纲见：[docs/product/teaching-collaboration-outline.md](../product/teaching-collaboration-outline.md)。

## 2. 已完成

1. 通信治理规范与契约文档已建立。
2. [apps/api](../../apps/api/) 与 [apps/web](../../apps/web/) 已创建通信骨架目录与类型占位。
3. 根工作区已配置 workspaces 构建与打包脚本。
4. 已补充最小构建/打包流程文档。
5. 已完成教学协作平台的新产品定位与 MVP 大纲。

## 3. 当前形态

- 产品层：已明确从泛协作转向教学项目过程评价。
- 架构层：文档驱动 + 目录骨架就绪。
- 代码层：通信框架占位文件已就位。
- 运行层：已有 Socket 登录与在线状态 demo，但尚未形成完整业务服务。

## 4. 概念映射

当前工程中的 Team/Project/Task/Docs/Feed 概念可以复用，但需要切换为教学语义。

| 原概念 | 教学版概念 |
| --- | --- |
| Team | Course / Class |
| Project | Assignment / Course Project |
| Task | Stage Task / Group Task |
| Chat | Group Discussion / Teacher Feedback |
| Docs | Submissions / Course Materials |
| Feed | Progress Timeline |
| RAG | Course Knowledge Q&A |
| AI 站会助手 | AI Teaching Assistant |

## 5. MVP 风险状态

- 产品范围风险：中。需要避免继续做成大而全协作平台。
- 通信边界风险：低。已有 HTTP/Socket/Worker 分层规则。
- 工程可运行性风险：中。需要尽快初始化真实 api/web 服务。
- 教学场景验证风险：中。需要用老师端看板和学生端提交台验证价值。

## 6. 下一步建议

1. 确认 [docs/product/teaching-collaboration-outline.md](../product/teaching-collaboration-outline.md) 是否作为组内统一方向。
2. 初始化 [apps/api](../../apps/api/) 与 [apps/web](../../apps/web/) 可运行脚手架。
3. 设计核心数据模型：Course、Group、Assignment、Stage、Submission、Review、Grade。
4. 以“老师发布阶段任务 -> 小组提交 -> 老师评价反馈”作为第一条端到端功能链路。
5. 将通信契约从通用任务评论逐步改为教学场景接口。
