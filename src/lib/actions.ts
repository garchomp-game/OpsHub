import { createClient } from "@/lib/supabase/server";
import { requireAuth, type CurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import type { ActionResult } from "@/types";

// ─── Server Action ラッパー ──────────────────────────

/**
 * 認証付き Server Action のラッパー。
 * 認証チェック + エラーハンドリングを自動化する。
 *
 * 使用例:
 * ```ts
 * export const createProject = withAuth(async (user, supabase, input: CreateProjectInput) => {
 *   // user: CurrentUser, supabase: SupabaseClient
 *   const { data, error } = await supabase.from("projects").insert(...)
 *   return data;
 * });
 * ```
 */
export function withAuth<TInput, TOutput>(
    handler: (
        user: CurrentUser,
        supabase: Awaited<ReturnType<typeof createClient>>,
        input: TInput
    ) => Promise<TOutput>
) {
    return async (input: TInput): Promise<ActionResult<TOutput>> => {
        try {
            const user = await requireAuth();
            const supabase = await createClient();
            const result = await handler(user, supabase, input);
            return { success: true, data: result };
        } catch (error) {
            const message = error instanceof Error ? error.message : "予期しないエラーが発生しました";
            const code = message.startsWith("ERR-") ? message.split(":")[0].trim() : "ERR-SYS-001";
            logger.error("Server Action failed", { code }, error instanceof Error ? error : undefined);
            return {
                success: false,
                error: { code, message },
            };
        }
    };
}

// ─── 監査ログヘルパー ────────────────────────────────

interface AuditLogInput {
    tenantId: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
}

/**
 * 監査ログを記録する。
 * Server Action 内から呼び出す。
 */
export async function writeAuditLog(
    supabase: Awaited<ReturnType<typeof createClient>>,
    userId: string,
    input: AuditLogInput
) {
    await supabase.from("audit_logs").insert({
        tenant_id: input.tenantId,
        user_id: userId,
        action: input.action,
        resource_type: input.resourceType,
        resource_id: input.resourceId,
        before_data: input.before ?? null,
        after_data: input.after ?? null,
        metadata: input.metadata ?? {},
    });
}
