import type { EventName } from "../shared/contracts.js";

export const eventCatalog: Record<EventName, { channel: "socket" | "worker"; description: string }> = {
  "task.created": {
    channel: "socket",
    description: "任务创建后推送给项目成员",
  },
  "task.updated": {
    channel: "socket",
    description: "任务更新后推送列表刷新",
  },
  "task.comment.created": {
    channel: "socket",
    description: "任务评论新增后推送",
  },
  "chat.message.created": {
    channel: "socket",
    description: "聊天新消息推送",
  },
  "chat.read.updated": {
    channel: "socket",
    description: "已读状态更新推送",
  },
  "feed.notice.created": {
    channel: "socket",
    description: "动态通知推送",
  },
  "doc.uploaded": {
    channel: "worker",
    description: "文档上传后触发异步处理",
  },
  "doc.process.requested": {
    channel: "worker",
    description: "文档处理任务入队",
  },
  "doc.process.completed": {
    channel: "worker",
    description: "文档处理完成回调",
  },
};
