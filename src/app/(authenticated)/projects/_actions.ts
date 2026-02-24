"use server";

import { withAuth, writeAuditLog } from "@/lib/actions";
import { hasRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { ProjectStatus } from "@/types";
import { PROJECT_TRANSITIONS } from "@/types";

// ─── Types ──────────────────────────────────────────

type CreateProjectInput = {
    name: string;
    description?: string;
    start_date?: string;
    end_date?: string;
    pm_id: string;
};

type UpdateProjectInput = {
    project_id: string;
    name?: string;
    description?: string;
    status?: string;
    start_date?: string;
    end_date?: string;
    pm_id?: string;
};

type AddMemberInput = {
    project_id: string;
    user_id: string;
};

type RemoveMemberInput = {
    project_id: string;
    user_id: string;
};

// ─── Create ─────────────────────────────────────────

export const createProject = withAuth(async (user, supabase, input: CreateProjectInput) => {
    const tenantId = user.tenantIds[0];
    if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");

    // 権限チェック: PM or Tenant Admin
    const hasPermission = hasRole(user, tenantId, ["pm", "tenant_admin"]);
    if (!hasPermission) throw new Error("ERR-AUTH-003: 権限がありません");

    // バリデーション
    if (!input.name || input.name.trim().length === 0) {
        throw new Error("ERR-VAL-001: プロジェクト名は必須です");
    }
    if (input.name.length > 100) {
        throw new Error("ERR-VAL-002: プロジェクト名は100文字以内で入力してください");
    }
    if (input.start_date && input.end_date && input.end_date < input.start_date) {
        throw new Error("ERR-VAL-003: 終了日は開始日以降にしてください");
    }

    // PM がテナント内に存在するか確認
    const { data: pmExists } = await supabase
        .from("user_roles")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("user_id", input.pm_id)
        .limit(1)
        .single();

    if (!pmExists) {
        throw new Error("ERR-VAL-004: 指定されたPMが見つかりません");
    }

    const { data, error } = await supabase
        .from("projects")
        .insert({
            name: input.name.trim(),
            description: input.description || null,
            status: "planning",
            start_date: input.start_date || null,
            end_date: input.end_date || null,
            pm_id: input.pm_id,
            tenant_id: tenantId,
            created_by: user.id,
        })
        .select()
        .single();

    if (error) throw new Error(`ERR-SYS-001: ${error.message}`);

    // PM をメンバーとして自動追加
    await supabase.from("project_members").insert({
        project_id: data.id,
        user_id: input.pm_id,
        tenant_id: tenantId,
    });

    await writeAuditLog(supabase, user.id, {
        tenantId,
        action: "project.create",
        resourceType: "project",
        resourceId: data.id,
        after: data as unknown as Record<string, unknown>,
    });

    revalidatePath("/projects");
    return data;
});

// ─── Update ─────────────────────────────────────────

export const updateProject = withAuth(async (user, supabase, input: UpdateProjectInput) => {
    const tenantId = user.tenantIds[0];
    if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");

    // 現在のプロジェクトを取得
    const { data: current, error: fetchErr } = await supabase
        .from("projects")
        .select("*")
        .eq("id", input.project_id)
        .eq("tenant_id", tenantId)
        .single();

    if (fetchErr || !current) throw new Error("ERR-PJ-001: プロジェクトが見つかりません");

    // 権限チェック: 対象PJの PM or Tenant Admin
    const hasPermission = hasRole(user, tenantId, ["tenant_admin"]) || current.pm_id === user.id;

    if (!hasPermission) throw new Error("ERR-AUTH-003: 権限がありません");

    // ステータス遷移チェック
    let auditAction = "project.update";
    if (input.status && input.status !== current.status) {
        const currentStatus = current.status as ProjectStatus;
        const allowed = PROJECT_TRANSITIONS[currentStatus] || [];
        if (!allowed.includes(input.status as ProjectStatus)) {
            throw new Error(`ERR-PJ-002: ${current.status} から ${input.status} への遷移はできません`);
        }
        auditAction = "project.status_change";
    }

    // バリデーション
    if (input.name !== undefined && input.name.trim().length === 0) {
        throw new Error("ERR-VAL-001: プロジェクト名は必須です");
    }
    if (input.name !== undefined && input.name.length > 100) {
        throw new Error("ERR-VAL-002: プロジェクト名は100文字以内で入力してください");
    }

    const startDate = input.start_date ?? current.start_date;
    const endDate = input.end_date ?? current.end_date;
    if (startDate && endDate && endDate < startDate) {
        throw new Error("ERR-VAL-003: 終了日は開始日以降にしてください");
    }

    const updateData: Record<string, unknown> = { updated_by: user.id };
    if (input.name !== undefined) updateData.name = input.name.trim();
    if (input.description !== undefined) updateData.description = input.description;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.start_date !== undefined) updateData.start_date = input.start_date;
    if (input.end_date !== undefined) updateData.end_date = input.end_date;
    if (input.pm_id !== undefined) updateData.pm_id = input.pm_id;

    const { data, error } = await supabase
        .from("projects")
        .update(updateData)
        .eq("id", input.project_id)
        .select()
        .single();

    if (error) throw new Error(`ERR-SYS-001: ${error.message}`);

    await writeAuditLog(supabase, user.id, {
        tenantId,
        action: auditAction,
        resourceType: "project",
        resourceId: input.project_id,
        before: current as unknown as Record<string, unknown>,
        after: data as unknown as Record<string, unknown>,
    });

    revalidatePath(`/projects/${input.project_id}`);
    revalidatePath("/projects");
    return data;
});

// ─── Add Member ─────────────────────────────────────

export const addMember = withAuth(async (user, supabase, input: AddMemberInput) => {
    const tenantId = user.tenantIds[0];
    if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");

    // プロジェクト取得 + 権限チェック
    const { data: project } = await supabase
        .from("projects")
        .select("id, pm_id")
        .eq("id", input.project_id)
        .eq("tenant_id", tenantId)
        .single();

    if (!project) throw new Error("ERR-PJ-001: プロジェクトが見つかりません");

    const hasPermission = hasRole(user, tenantId, ["tenant_admin"]) || project.pm_id === user.id;

    if (!hasPermission) throw new Error("ERR-AUTH-003: 権限がありません");

    // ユーザーがテナント内に存在するか
    const { data: userExists } = await supabase
        .from("user_roles")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("user_id", input.user_id)
        .limit(1)
        .single();

    if (!userExists) throw new Error("ERR-VAL-005: 指定されたユーザーが見つかりません");

    // 既にメンバーか
    const { data: existing } = await supabase
        .from("project_members")
        .select("id")
        .eq("project_id", input.project_id)
        .eq("user_id", input.user_id)
        .limit(1)
        .single();

    if (existing) throw new Error("ERR-PJ-003: このユーザーは既にメンバーです");

    const { error } = await supabase.from("project_members").insert({
        project_id: input.project_id,
        user_id: input.user_id,
        tenant_id: tenantId,
    });

    if (error) throw new Error(`ERR-SYS-001: ${error.message}`);

    await writeAuditLog(supabase, user.id, {
        tenantId,
        action: "project.add_member",
        resourceType: "project",
        resourceId: input.project_id,
        after: { user_id: input.user_id },
    });

    revalidatePath(`/projects/${input.project_id}`);
    return { success: true };
});

// ─── Remove Member ──────────────────────────────────

export const removeMember = withAuth(async (user, supabase, input: RemoveMemberInput) => {
    const tenantId = user.tenantIds[0];
    if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");

    // プロジェクト取得 + 権限チェック
    const { data: project } = await supabase
        .from("projects")
        .select("id, pm_id")
        .eq("id", input.project_id)
        .eq("tenant_id", tenantId)
        .single();

    if (!project) throw new Error("ERR-PJ-001: プロジェクトが見つかりません");

    // PM は直接削除不可
    if (input.user_id === project.pm_id) {
        throw new Error("ERR-PJ-004: PMは直接削除できません。先にPM変更をしてください");
    }

    const hasPermission = hasRole(user, tenantId, ["tenant_admin"]) || project.pm_id === user.id;

    if (!hasPermission) throw new Error("ERR-AUTH-003: 権限がありません");

    const { error } = await supabase
        .from("project_members")
        .delete()
        .eq("project_id", input.project_id)
        .eq("user_id", input.user_id);

    if (error) throw new Error(`ERR-SYS-001: ${error.message}`);

    await writeAuditLog(supabase, user.id, {
        tenantId,
        action: "project.remove_member",
        resourceType: "project",
        resourceId: input.project_id,
        before: { user_id: input.user_id },
    });

    revalidatePath(`/projects/${input.project_id}`);
    return { success: true };
});

// ─── Helpers ────────────────────────────────────────

export const getTenantUsers = withAuth(async (user, supabase, _input: void) => {
    const tenantId = user.tenantIds[0];
    if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");

    const { data } = await supabase
        .from("user_roles")
        .select("user_id, role, profiles!inner(display_name)")
        .eq("tenant_id", tenantId);

    return (data ?? []).map((d) => ({
        user_id: d.user_id,
        role: d.role,
        display_name: (d.profiles as unknown as { display_name: string }).display_name,
    }));
});
