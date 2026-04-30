# services

此目录定义业务领域边界，是系统可维护性的核心。

## 子目录

- [auth](auth/)：认证、授权、RBAC 占位
- [course](course/)：课程空间与班级管理占位
- [group](group/)：小组与成员管理占位
- [assignment](assignment/)：课程项目与阶段生命周期占位
- [collaboration](collaboration/)：小组任务、讨论、文件与动态流占位
- [submission](submission/)：阶段提交与材料管理占位
- [grading](grading/)：Rubric、互评、贡献与评分占位
- [rag](rag/)：检索增强问答后续增强占位

## 建议分层

- controller：接口层，处理输入输出
- service：业务编排层
- repository：数据访问层
- domain：领域模型与规则

## 设计原则

- 模块之间通过服务接口或事件通信
- 禁止跨模块直接访问数据库表
- 每个模块自带测试与文档
