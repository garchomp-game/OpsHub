// ─── Server Action 統一レスポンス型 ────────────────
// Based on: spec/errors/index.md

export type ActionResult<T> =
    | { success: true; data: T }
    | { success: false; error: { code: string; message: string; fields?: Record<string, string> } };

// ─── ロール ─────────────────────────────────────────

export const ROLES = [
    "member",
    "approver",
    "pm",
    "accounting",
    "it_admin",
    "tenant_admin",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
    member: "メンバー",
    approver: "承認者",
    pm: "PM",
    accounting: "経理",
    it_admin: "IT管理者",
    tenant_admin: "テナント管理者",
};

// ─── ユーザーステータス ─────────────────────────────

export const USER_STATUSES = ["active", "invited", "disabled"] as const;

export type UserStatus = (typeof USER_STATUSES)[number];

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
    active: "有効",
    invited: "招待中",
    disabled: "無効",
};

export const USER_STATUS_COLORS: Record<UserStatus, string> = {
    active: "green",
    invited: "gold",
    disabled: "red",
};

// ─── ステータス列挙 ────────────────────────────────

export const WORKFLOW_STATUSES = [
    "draft",
    "submitted",
    "approved",
    "rejected",
    "withdrawn",
] as const;

export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export const PROJECT_STATUSES = [
    "planning",
    "active",
    "completed",
    "cancelled",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const WORKFLOW_TYPES = [
    "expense",
    "leave",
    "purchase",
    "other",
] as const;

export type WorkflowType = (typeof WORKFLOW_TYPES)[number];

// ─── エラーコードプレフィックス ─────────────────────

export const ERROR_PREFIXES = {
    AUTH: "ERR-AUTH",
    VALIDATION: "ERR-VAL",
    WORKFLOW: "ERR-WF",
    PROJECT: "ERR-PJ",
    EXPENSE: "ERR-EXP",
    INVOICE: "ERR-INV",
    SYSTEM: "ERR-SYS",
} as const;

// ─── 状態遷移ルール ────────────────────────────────

export const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
    todo: ["in_progress"],
    in_progress: ["todo", "done"],
    done: ["in_progress"],
};

export const PROJECT_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
    planning: ["active", "cancelled"],
    active: ["completed", "cancelled"],
    completed: [],
    cancelled: [],
};

export const WORKFLOW_TRANSITIONS: Record<WorkflowStatus, WorkflowStatus[]> = {
    draft: ["submitted"],
    submitted: ["approved", "rejected", "withdrawn"],
    approved: [],
    rejected: ["submitted", "withdrawn"],
    withdrawn: [],
};
