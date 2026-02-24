"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuth, hasRole } from "@/lib/auth";
import type { Tables } from "@/types/database";

type AuditLogRow = Tables<"audit_logs">;

// ─── 入力型 ──────────────────────────────────────────

export interface FetchAuditLogsInput {
    page: number;
    pageSize: number;
    dateFrom?: string; // ISO date string e.g. "2026-01-01"
    dateTo?: string; // ISO date string e.g. "2026-01-31"
    userId?: string;
    action?: string;
    resourceType?: string;
}

export interface FetchAuditLogsResult {
    logs: AuditLogRow[];
    total: number;
}

export interface FilterOptions {
    userIds: { id: string; displayName: string }[];
    actionTypes: string[];
    resourceTypes: string[];
}

// ─── Server Actions ──────────────────────────────────

/**
 * 監査ログをサーバーサイドでフィルタ+ページネーション取得する。
 * IT Admin / Tenant Admin のみ呼び出し可能。
 */
export async function fetchAuditLogs(
    input: FetchAuditLogsInput
): Promise<FetchAuditLogsResult> {
    const user = await requireAuth();

    const tenantId = user.tenantIds[0];
    if (!tenantId) {
        throw new Error("ERR-AUTH-003: テナントが見つかりません");
    }

    // 管理者権限チェック
    if (!hasRole(user, tenantId, ["it_admin", "tenant_admin"])) {
        throw new Error("ERR-AUTH-002: アクセス権がありません");
    }

    const supabase = await createClient();

    // クエリ構築
    let query = supabase
        .from("audit_logs")
        .select("*", { count: "exact" })
        .eq("tenant_id", tenantId);

    // フィルタ適用
    if (input.userId) {
        query = query.eq("user_id", input.userId);
    }
    if (input.action) {
        query = query.eq("action", input.action);
    }
    if (input.resourceType) {
        query = query.eq("resource_type", input.resourceType);
    }
    if (input.dateFrom) {
        query = query.gte("created_at", `${input.dateFrom}T00:00:00`);
    }
    if (input.dateTo) {
        query = query.lte("created_at", `${input.dateTo}T23:59:59`);
    }

    // ページネーション
    const from = (input.page - 1) * input.pageSize;
    const to = from + input.pageSize - 1;

    const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

    if (error) {
        throw new Error(`ERR-SYS-001: ${error.message}`);
    }

    return {
        logs: data ?? [],
        total: count ?? 0,
    };
}

/**
 * フィルタ用の選択肢を取得する。
 * ユーザーID一覧、アクション種別、リソース種別を返す。
 */
export async function fetchFilterOptions(): Promise<FilterOptions> {
    const user = await requireAuth();

    const tenantId = user.tenantIds[0];
    if (!tenantId) {
        throw new Error("ERR-AUTH-003: テナントが見つかりません");
    }

    if (!hasRole(user, tenantId, ["it_admin", "tenant_admin"])) {
        throw new Error("ERR-AUTH-002: アクセス権がありません");
    }

    const supabase = await createClient();

    // ユーザーID一覧（プロフィール名付き）
    const { data: userRoles } = await supabase
        .from("user_roles")
        .select("user_id, profiles!inner(display_name)")
        .eq("tenant_id", tenantId);

    const uniqueUsersMap = new Map<string, string>();
    for (const ur of userRoles ?? []) {
        if (!uniqueUsersMap.has(ur.user_id)) {
            uniqueUsersMap.set(
                ur.user_id,
                (ur.profiles as unknown as { display_name: string }).display_name,
            );
        }
    }

    const uniqueUserIds = Array.from(uniqueUsersMap.entries()).map(([id, displayName]) => ({
        id,
        displayName,
    }));

    // アクション種別・リソース種別は定数リストを使用
    // （全件スキャンを避け、UI表示ラベルとも整合させる）
    const actionTypes = [
        "workflow.create",
        "workflow.submit",
        "workflow.approve",
        "workflow.reject",
        "workflow.withdraw",
        "project.create",
        "project.update",
        "project.delete",
        "project.add_member",
        "project.remove_member",
        "task.create",
        "task.update",
        "task.delete",
        "task.status_change",
        "user.invite",
        "user.role_change",
        "user.activate",
        "user.deactivate",
        "tenant.update",
        "tenant.delete",
        "timesheet.create",
        "timesheet.update",
        "timesheet.delete",
    ];

    const resourceTypes = [
        "workflow",
        "project",
        "task",
        "user",
        "tenant",
        "timesheet",
        "expense",
    ];

    return {
        userIds: uniqueUserIds,
        actionTypes,
        resourceTypes,
    };
}
