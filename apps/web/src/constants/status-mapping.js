const STATUS_META = {
  active: { label: "活跃", tone: "active" },
  draft: { label: "草稿", tone: "draft" },
  pending: { label: "待处理", tone: "pending" },
  updated: { label: "已更新", tone: "updated" },
  submitted: { label: "已提交", tone: "submitted" },
  "under-review": { label: "审核中", tone: "under-review" },
  approved: { label: "通过", tone: "approved" },
  "needs-changes": { label: "需修改", tone: "needs-changes" },
  "not-submitted": { label: "未提交", tone: "not-submitted" },
  reviewed: { label: "已处理", tone: "reviewed" },
  missing: { label: "缺失", tone: "missing" },
  processed: { label: "已处理", tone: "processed" },
  filled: { label: "已填写", tone: "filled" },
  unread: { label: "未读", tone: "unread" },
  muted: { label: "已静音", tone: "muted" },
  archived: { label: "已归档", tone: "archived" },
  following: { label: "关注中", tone: "following" },
  ready: { label: "就绪", tone: "ready" },
  online: { label: "在线", tone: "online" },
  offline: { label: "离线", tone: "offline" },
  urgent: { label: "紧急", tone: "urgent" },
  "at-risk": { label: "风险", tone: "at-risk" },
  "on-track": { label: "正常", tone: "on-track" },
  selected: { label: "已选", tone: "selected" },
  new: { label: "新", tone: "new" },
  "in-progress": { label: "进行中", tone: "in-progress" },
  todo: { label: "待办", tone: "todo" },
  optional: { label: "可选", tone: "optional" },
  stored: { label: "已存储", tone: "stored" },
  linked: { label: "已关联", tone: "linked" },
  blocked: { label: "阻塞", tone: "blocked" },
  late: { label: "逾期", tone: "late" }
};

const LEGACY_STATUS_ALIASES = {
  under_review: "under-review",
  needs_review: "under-review",
  review: "under-review",
  needs_changes: "needs-changes",
  resubmitted: "submitted",
  not_submitted: "not-submitted",
  mark_reviewed: "reviewed",
  watch: "following",
  follow: "following",
  watching: "following",
  at_risk: "at-risk",
  "at risk": "at-risk",
  on_track: "on-track",
  "on track": "on-track",
  in_progress: "in-progress"
};

export { LEGACY_STATUS_ALIASES, STATUS_META };

export const STATUS_LABELS_ZH = Object.fromEntries(
  Object.entries(STATUS_META).map(([state, meta]) => [state, meta.label])
);

export function normalizeStatus(rawStatus) {
  const status = String(rawStatus || "").trim().toLowerCase().replace(/_/g, "-");
  if (!status) {
    return "";
  }

  return LEGACY_STATUS_ALIASES[status] || status;
}

export function getStatusMeta(rawStatus) {
  const status = normalizeStatus(rawStatus);
  return {
    state: status,
    label: STATUS_META[status]?.label || status,
    tone: STATUS_META[status]?.tone || status
  };
}

export function getStatusLabelZh(rawStatus) {
  return getStatusMeta(rawStatus).label;
}

export function getStatusBadgeClass(rawStatus) {
  const { tone } = getStatusMeta(rawStatus);
  return tone ? `badge badge--${tone}` : "badge";
}
