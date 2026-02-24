"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuth, requireRole } from "@/lib/auth";
import { withAuth, writeAuditLog } from "@/lib/actions";
import type { ActionResult } from "@/types";
import type { Json } from "@/types/database";

// ─── Types ──────────────────────────────────────────

export type TenantSettings = {
    default_approval_route?: string;
    notification_email?: boolean;
    notification_in_app?: boolean;
    timezone?: string;
    fiscal_year_start?: number;
};

export type TenantStats = {
    active_users: number;
    project_count: number;
    monthly_workflows: number;
};

export type TenantDetail = {
    id: string;
    name: string;
    slug: string;
    settings: TenantSettings;
    created_at: string;
    updated_at: string;
    stats: TenantStats;
};

// ─── テナント情報取得 ───────────────────────────────

export async function getTenantDetail(
    tenantId: string
): Promise<ActionResult<TenantDetail>> {
    try {
        const user = await requireRole(tenantId, [
            "tenant_admin",
            "it_admin",
        ]);
        const supabase = await createClient();

        const { data: tenant, error } = await supabase
            .from("tenants")
            .select("*")
            .eq("id", tenantId)
            .single();

        if (error || !tenant) {
            return {
                success: false,
                error: {
                    code: "ERR-SYS-001",
                    message: "テナント情報の取得に失敗しました",
                },
            };
        }

        // 統計情報の取得
        const [usersResult, projectsResult, workflowsResult] =
            await Promise.all([
                supabase
                    .from("user_roles")
                    .select("id", { count: "exact" })
                    .eq("tenant_id", tenantId),
                supabase
                    .from("projects")
                    .select("id", { count: "exact" })
                    .eq("tenant_id", tenantId),
                supabase
                    .from("workflows")
                    .select("id", { count: "exact" })
                    .eq("tenant_id", tenantId),
            ]);

        const settings = (tenant.settings ?? {}) as TenantSettings;

        return {
            success: true,
            data: {
                id: tenant.id,
                name: tenant.name,
                slug: tenant.slug,
                settings,
                created_at: tenant.created_at,
                updated_at: tenant.updated_at,
                stats: {
                    active_users: usersResult.count ?? 0,
                    project_count: projectsResult.count ?? 0,
                    monthly_workflows: workflowsResult.count ?? 0,
                },
            },
        };
    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : "予期しないエラーが発生しました";
        return {
            success: false,
            error: {
                code: message.startsWith("ERR-")
                    ? message.split(":")[0].trim()
                    : "ERR-SYS-001",
                message,
            },
        };
    }
}

// ─── テナント情報更新 ───────────────────────────────

type UpdateTenantInput = {
    tenantId: string;
    name?: string;
    contact_email?: string;
    address?: string;
};

export const updateTenant = withAuth(async (user, supabase, input: UpdateTenantInput) => {
    await requireRole(input.tenantId, ["tenant_admin", "it_admin"]);

    // バリデーション
    if (input.name !== undefined && input.name.trim() === "") {
        throw new Error("ERR-VAL-001: 組織名は必須です");
    }
    if (input.name !== undefined && input.name.length > 100) {
        throw new Error(
            "ERR-VAL-002: 組織名は100文字以内で入力してください"
        );
    }
    if (
        input.contact_email !== undefined &&
        input.contact_email !== "" &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.contact_email)
    ) {
        throw new Error(
            "ERR-VAL-003: 有効なメールアドレスを入力してください"
        );
    }

    // 更新前データ取得
    const { data: before } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", input.tenantId)
        .single();

    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) updateData.name = input.name.trim();
    // contact_email, address は settings JSON 内に保存
    if (input.contact_email !== undefined || input.address !== undefined) {
        const currentSettings = (before?.settings ?? {}) as Record<string, unknown>;
        if (input.contact_email !== undefined)
            currentSettings.contact_email = input.contact_email;
        if (input.address !== undefined)
            currentSettings.address = input.address;
        updateData.settings = currentSettings as Json;
    }

    const { data: updated, error } = await supabase
        .from("tenants")
        .update(updateData)
        .eq("id", input.tenantId)
        .select()
        .single();

    if (error) {
        throw new Error("ERR-SYS-001: テナント情報の更新に失敗しました");
    }

    await writeAuditLog(supabase, user.id, {
        tenantId: input.tenantId,
        action: "tenant.update",
        resourceType: "tenant",
        resourceId: input.tenantId,
        before: before as Record<string, unknown>,
        after: updated as Record<string, unknown>,
    });

    return updated;
});

// ─── テナント設定変更 ───────────────────────────────

type UpdateTenantSettingsInput = {
    tenantId: string;
    settings: TenantSettings;
};

export const updateTenantSettings = withAuth(
    async (user, supabase, input: UpdateTenantSettingsInput) => {
        await requireRole(input.tenantId, ["tenant_admin", "it_admin"]);

        // バリデーション
        if (
            input.settings.fiscal_year_start !== undefined &&
            (input.settings.fiscal_year_start < 1 ||
                input.settings.fiscal_year_start > 12)
        ) {
            throw new Error(
                "ERR-VAL-004: 会計年度の開始月は1〜12で指定してください"
            );
        }

        // 更新前設定取得
        const { data: before } = await supabase
            .from("tenants")
            .select("settings")
            .eq("id", input.tenantId)
            .single();

        const currentSettings = (before?.settings ?? {}) as Record<
            string,
            unknown
        >;
        const newSettings = { ...currentSettings, ...input.settings };

        const { data: updated, error } = await supabase
            .from("tenants")
            .update({ settings: newSettings as Json })
            .eq("id", input.tenantId)
            .select()
            .single();

        if (error) {
            throw new Error(
                "ERR-SYS-001: テナント設定の更新に失敗しました"
            );
        }

        await writeAuditLog(supabase, user.id, {
            tenantId: input.tenantId,
            action: "tenant.settings_change",
            resourceType: "tenant",
            resourceId: input.tenantId,
            before: { settings: currentSettings },
            after: { settings: newSettings },
        });

        return updated;
    }
);

// ─── テナント削除 ───────────────────────────────────

type DeleteTenantInput = {
    tenantId: string;
    confirmation: string;
};

export const deleteTenant = withAuth(
    async (user, supabase, input: DeleteTenantInput) => {
        // IT Admin のみ
        await requireRole(input.tenantId, ["it_admin"]);

        // テナント名の確認
        const { data: tenant } = await supabase
            .from("tenants")
            .select("name")
            .eq("id", input.tenantId)
            .single();

        if (!tenant) {
            throw new Error("ERR-SYS-001: テナントが見つかりません");
        }

        if (input.confirmation !== tenant.name) {
            throw new Error(
                "ERR-VAL-005: 確認のためテナント名を正確に入力してください"
            );
        }

        // テナント論理削除（30日間復元可能）
        const { error } = await supabase
            .from("tenants")
            .update({ deleted_at: new Date().toISOString() })
            .eq("id", input.tenantId);

        if (error) {
            throw new Error(
                "ERR-SYS-001: テナントの削除に失敗しました"
            );
        }

        await writeAuditLog(supabase, user.id, {
            tenantId: input.tenantId,
            action: "tenant.soft_delete",
            resourceType: "tenant",
            resourceId: input.tenantId,
            before: tenant as Record<string, unknown>,
        });

        return { deleted: true };
    }
);
