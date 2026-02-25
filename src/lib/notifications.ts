import type { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// ─── 通知作成ヘルパー ────────────────────────────────

interface CreateNotificationInput {
    tenantId: string;
    userId: string;
    type: string;
    title: string;
    body?: string;
    resourceType?: string;
    resourceId?: string;
}

/**
 * 通知レコードを作成する。
 * 他チケットのServer Actionから呼び出される共通ヘルパー。
 *
 * 使用例:
 * ```ts
 * await createNotification(supabase, {
 *   tenantId: user.tenantIds[0],
 *   userId: approverId,
 *   type: "workflow_submitted",
 *   title: "新しい申請が届きました",
 *   body: `${workflow.title} が送信されました`,
 *   resourceType: "workflow",
 *   resourceId: workflow.id,
 * });
 * ```
 */
export async function createNotification(
    supabase: Awaited<ReturnType<typeof createClient>>,
    input: CreateNotificationInput
) {
    const { error } = await supabase.from("notifications").insert({
        tenant_id: input.tenantId,
        user_id: input.userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        resource_type: input.resourceType ?? null,
        resource_id: input.resourceId ?? null,
    });

    if (error) {
        logger.error("通知の作成に失敗しました", { userId: input.userId, type: input.type, supabaseError: error });
    }
}

// ─── リソースリンク生成 ────────────────────────────────

/**
 * 通知のリソース情報からリンク先URLを生成する。
 */
export function getNotificationLink(
    resourceType: string | null,
    resourceId: string | null
): string | null {
    if (!resourceType || !resourceId) return null;

    const routes: Record<string, string> = {
        workflow: `/workflows/${resourceId}`,
        project: `/projects/${resourceId}`,
        task: `/projects`, // タスクはプロジェクト配下のため一覧へ
        expense: `/expenses`,
    };

    return routes[resourceType] ?? null;
}
