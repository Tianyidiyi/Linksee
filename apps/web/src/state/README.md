# apps/web/src/state

前端页面状态组织边界。

当前 P0 先保留目录边界，后续页面实现时再沉淀具体状态模块。该目录用于承接：

- HTTP 查询结果缓存
- Socket 增量事件合并
- 页面级 loading / error / empty 状态
- 老师、学生、助教三类角色看板的派生状态

硬规则：

- 写操作仍然通过 [src/api](../api/) 调用 HTTP 接口。
- Socket 事件只用于更新本地状态，不直接触发业务写库。
- 同一实时事件必须按 eventId 去重。
