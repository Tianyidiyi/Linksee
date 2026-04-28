# services

此目录定义业务领域边界，是系统可维护性的核心。

## 子目录

- auth：认证、授权、RBAC（规划中）
- course：课程空间与班级管理（规划中）
- group：小组与成员管理（规划中）
- assignment：课程项目与阶段任务生命周期（规划中）
- collaboration：小组任务、讨论、文件与动态流（规划中）
- submission：阶段提交与材料管理（规划中）
- grading：Rubric、互评、贡献与评分（规划中）
- rag：检索增强问答（后续增强）

## 建议分层

- controller：接口层，处理输入输出
- service：业务编排层
- repository：数据访问层
- domain：领域模型与规则

## 设计原则

- 模块之间通过服务接口或事件通信
- 禁止跨模块直接访问数据库表
- 每个模块自带测试与文档
