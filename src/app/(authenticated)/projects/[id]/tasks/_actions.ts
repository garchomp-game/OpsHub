"use server";

import { withAuth, writeAuditLog } from "@/lib/actions";
import { hasRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { TaskStatus } from "@/types";
import { TASK_TRANSITIONS } from "@/types";

// ─── Types ──────────────────────────────────────────

type CreateTaskInput = {
    project_id: string;
    title: string;
    description?: string;
    assignee_id?: string;
    due_date?: string;
};

type UpdateTaskInput = {
    task_id: string;
    title?: string;
    description?: string;
    assignee_id?: string | null;
    due_date?: string | null;
};

type ChangeTaskStatusInput = {
    task_id: string;
    status: string;
};

type DeleteTaskInput = {
    task_id: string;
};

// ─── Create ─────────────────────────────────────────

export const createTask = withAuth(async (user, supabase, input: CreateTaskInput) => {
    const tenantId = user.tenantIds[0];
    if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");

    // プロジェクト取得
    const { data: project } = await supabase
        .from("projects")
        .select("id, pm_id, tenant_id")
        .eq("id", input.project_id)
        .eq("tenant_id", tenantId)
        .single();

    if (!project) throw new Error("ERR-PJ-001: プロジェクトが見つかりません");

    // 権限チェック: PM or Tenant Admin
    const isPm = project.pm_id === user.id;
    const isTenantAdmin = hasRole(user, tenantId, ["tenant_admin"]);
    if (!isPm && !isTenantAdmin) throw new Error("ERR-AUTH-003: 権限がありません");

    // バリデーション
    if (!input.title || input.title.trim().length === 0) {
        throw new Error("ERR-VAL-001: タスク名は必須です");
    }
    if (input.title.length > 200) {
        throw new Error("ERR-VAL-002: タスク名は200文字以内で入力してください");
    }

    // assignee_id がPJメンバーに存在するか検証
    if (input.assignee_id) {
        const { data: memberExists } = await supabase
            .from("project_members")
            .select("id")
            .eq("project_id", input.project_id)
            .eq("user_id", input.assignee_id)
            .limit(1)
            .single();

        if (!memberExists) {
            throw new Error("ERR-VAL-005: 指定したユーザーはこのプロジェクトのメンバーではありません");
        }
    }

    const { data, error } = await supabase
        .from("tasks")
        .insert({
            title: input.title.trim(),
            description: input.description || null,
            status: "todo",
            assignee_id: input.assignee_id || null,
            due_date: input.due_date || null,
            project_id: input.project_id,
            tenant_id: tenantId,
            created_by: user.id,
        })
        .select()
        .single();

    if (error) throw new Error(`ERR-SYS-001: ${error.message}`);

    await writeAuditLog(supabase, user.id, {
        tenantId,
        action: "task.create",
        resourceType: "task",
        resourceId: data.id,
        after: data as unknown as Record<string, unknown>,
    });

    revalidatePath(`/projects/${input.project_id}/tasks`);
    return data;
});

// ─── Update ─────────────────────────────────────────

export const updateTask = withAuth(async (user, supabase, input: UpdateTaskInput) => {
    const tenantId = user.tenantIds[0];
    if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");

    // 現在のタスクを取得
    const { data: current, error: fetchErr } = await supabase
        .from("tasks")
        .select("*, projects!inner(pm_id)")
        .eq("id", input.task_id)
        .eq("tenant_id", tenantId)
        .single();

    if (fetchErr || !current) throw new Error("ERR-TASK-001: タスクが見つかりません");

    // 権限チェック: PM or 担当者
    const project = current.projects as unknown as { pm_id: string };
    const isPm = project.pm_id === user.id;
    const isAssignee = current.assignee_id === user.id;
    const isTenantAdmin = hasRole(user, tenantId, ["tenant_admin"]);

    if (!isPm && !isAssignee && !isTenantAdmin) {
        throw new Error("ERR-AUTH-003: 権限がありません");
    }

    // バリデーション
    if (input.title !== undefined && input.title.trim().length === 0) {
        throw new Error("ERR-VAL-001: タスク名は必須です");
    }
    if (input.title !== undefined && input.title.length > 200) {
        throw new Error("ERR-VAL-002: タスク名は200文字以内で入力してください");
    }

    // assignee_id がPJメンバーに存在するか検証
    if (input.assignee_id) {
        const { data: memberExists } = await supabase
            .from("project_members")
            .select("id")
            .eq("project_id", current.project_id)
            .eq("user_id", input.assignee_id)
            .limit(1)
            .single();

        if (!memberExists) {
            throw new Error("ERR-VAL-005: 指定したユーザーはこのプロジェクトのメンバーではありません");
        }
    }

    const updateData: Record<string, unknown> = {};
    if (input.title !== undefined) updateData.title = input.title.trim();
    if (input.description !== undefined) updateData.description = input.description;
    if (input.assignee_id !== undefined) updateData.assignee_id = input.assignee_id;
    if (input.due_date !== undefined) updateData.due_date = input.due_date;

    const { data, error } = await supabase
        .from("tasks")
        .update(updateData)
        .eq("id", input.task_id)
        .select()
        .single();

    if (error) throw new Error(`ERR-SYS-001: ${error.message}`);

    await writeAuditLog(supabase, user.id, {
        tenantId,
        action: "task.update",
        resourceType: "task",
        resourceId: input.task_id,
        before: current as unknown as Record<string, unknown>,
        after: data as unknown as Record<string, unknown>,
    });

    revalidatePath(`/projects/${current.project_id}/tasks`);
    return data;
});

// ─── Change Status ──────────────────────────────────

export const changeTaskStatus = withAuth(async (user, supabase, input: ChangeTaskStatusInput) => {
    const tenantId = user.tenantIds[0];
    if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");

    const { data: current, error: fetchErr } = await supabase
        .from("tasks")
        .select("*, projects!inner(pm_id)")
        .eq("id", input.task_id)
        .eq("tenant_id", tenantId)
        .single();

    if (fetchErr || !current) throw new Error("ERR-TASK-001: タスクが見つかりません");

    // 権限チェック: PM or 担当者
    const project = current.projects as unknown as { pm_id: string };
    const isPm = project.pm_id === user.id;
    const isAssignee = current.assignee_id === user.id;
    const isTenantAdmin = hasRole(user, tenantId, ["tenant_admin"]);

    if (!isPm && !isAssignee && !isTenantAdmin) {
        throw new Error("ERR-AUTH-003: 権限がありません");
    }

    // ステータス遷移チェック
    const currentStatus = current.status as TaskStatus;
    const allowed = TASK_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(input.status as TaskStatus)) {
        throw new Error(`ERR-TASK-002: ${current.status} から ${input.status} への遷移はできません`);
    }

    const { data, error } = await supabase
        .from("tasks")
        .update({ status: input.status })
        .eq("id", input.task_id)
        .select()
        .single();

    if (error) throw new Error(`ERR-SYS-001: ${error.message}`);

    await writeAuditLog(supabase, user.id, {
        tenantId,
        action: "task.status_change",
        resourceType: "task",
        resourceId: input.task_id,
        before: { status: current.status },
        after: { status: input.status },
    });

    revalidatePath(`/projects/${current.project_id}/tasks`);
    return data;
});

// ─── Delete ─────────────────────────────────────────

export const deleteTask = withAuth(async (user, supabase, input: DeleteTaskInput) => {
    const tenantId = user.tenantIds[0];
    if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");

    const { data: current, error: fetchErr } = await supabase
        .from("tasks")
        .select("*, projects!inner(pm_id)")
        .eq("id", input.task_id)
        .eq("tenant_id", tenantId)
        .single();

    if (fetchErr || !current) throw new Error("ERR-TASK-001: タスクが見つかりません");

    // 権限チェック: PM or Tenant Admin のみ
    const project = current.projects as unknown as { pm_id: string };
    const isPm = project.pm_id === user.id;
    const isTenantAdmin = hasRole(user, tenantId, ["tenant_admin"]);

    if (!isPm && !isTenantAdmin) {
        throw new Error("ERR-AUTH-003: 権限がありません。タスク削除はPMのみ可能です");
    }

    // 工数記録チェック
    const { data: timesheetExists } = await supabase
        .from("timesheets")
        .select("id")
        .eq("task_id", input.task_id)
        .limit(1)
        .single();

    if (timesheetExists) {
        throw new Error("ERR-TASK-003: このタスクには工数が記録されています。削除できません");
    }

    const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", input.task_id);

    if (error) throw new Error(`ERR-SYS-001: ${error.message}`);

    await writeAuditLog(supabase, user.id, {
        tenantId,
        action: "task.delete",
        resourceType: "task",
        resourceId: input.task_id,
        before: current as unknown as Record<string, unknown>,
    });

    revalidatePath(`/projects/${current.project_id}/tasks`);
    return { success: true };
});
