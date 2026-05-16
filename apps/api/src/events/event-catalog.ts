import type { EventName } from "../shared/contracts.js";

export const eventCatalog: Record<EventName, { channel: "socket" | "worker"; description: string }> = {
  "assignment.created": {
    channel: "socket",
    description: "课程项目创建后推送给课程成员",
  },
  "stage.created": {
    channel: "socket",
    description: "阶段要求创建后推送给相关小组",
  },
  "course.message.created": {
    channel: "socket",
    description: "课程群消息新增后推送给课程成员",
  },
  "course.message.updated": {
    channel: "socket",
    description: "课程群消息编辑后推送给课程成员",
  },
  "course.message.deleted": {
    channel: "socket",
    description: "课程群消息撤回后推送给课程成员",
  },
  "course.member.updated": {
    channel: "socket",
    description: "课程成员增删后推送给课程成员",
  },
  "group.message.created": {
    channel: "socket",
    description: "小组讨论消息新增后推送给小组成员",
  },
  "group.message.updated": {
    channel: "socket",
    description: "小组讨论消息编辑后推送给小组成员",
  },
  "group.message.deleted": {
    channel: "socket",
    description: "小组讨论消息撤回后推送给小组成员",
  },
  "group.member.updated": {
    channel: "socket",
    description: "小组成员增删后推送给课程成员与小组成员",
  },
  "group.minitask.updated": {
    channel: "socket",
    description: "小组 MiniTask 更新后推送给小组成员和课程管理者",
  },
  "submission.created": {
    channel: "socket",
    description: "阶段提交创建后推送给老师和助教",
  },
  "submission.status.updated": {
    channel: "socket",
    description: "提交状态因反馈、重交或通过而变化后推送给相关角色",
  },
  "review.created": {
    channel: "socket",
    description: "老师或助教反馈创建后推送给对应小组",
  },
  "review.updated": {
    channel: "socket",
    description: "老师或助教反馈更新后推送给对应小组",
  },
  "grade.published": {
    channel: "socket",
    description: "老师发布最终成绩后推送给对应小组",
  },
  "grade.updated": {
    channel: "socket",
    description: "老师调整已发布成绩后推送给对应小组",
  },
  "course.dashboard.updated": {
    channel: "socket",
    description: "课程看板聚合数据更新后推送给老师和助教",
  },
  "material.uploaded": {
    channel: "worker",
    description: "课程或小组材料上传后触发异步处理",
  },
  "material.process.requested": {
    channel: "worker",
    description: "材料处理任务入队",
  },
  "material.process.completed": {
    channel: "worker",
    description: "材料处理完成回调",
  },
};
