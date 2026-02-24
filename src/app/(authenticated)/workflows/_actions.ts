"use server";

import { withAuth, writeAuditLog } from "@/lib/actions";
import { hasRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { WorkflowStatus } from "@/types";
import { WORKFLOW_TRANSITIONS } from "@/types";
import { createNotification } from "@/lib/notifications";

// ─── Types ──────────────────────────────────────────

type CreateWorkflowInput = {
    type: "expense" | "leave" | "purchase" | "other";
    title: string;
    description?: string;
    amount?: number;
    date_from?: string;
    date_to?: string;
    approver_id: string;
    status?: "draft" | "submitted";
};

type UpdateWorkflowInput = {
    workflow_id: string;
    title?: string;
    description?: string;
    amount?: number;
    date_from?: string;
    date_to?: string;
    approver_id?: string;
};

type TransitionWorkflowInput = {
    workflow_id: string;
    action: "submit" | "withdraw";
};

// ─── workflow_number 自動採番（並行安全） ────────────

async function generateWorkflowNumber(
    supabase: Parameters<Parameters<typeof withAuth>[0]>[1],
    tenantId: string
): Promise<string> {
    const { data, error } = await supabase.rpc("next_workflow_number", {
        p_tenant_id: tenantId,
    });

    if (error || !data) {
        throw new Error(`ERR-SYS-001: ワークフロー番号の採番に失敗しました: ${error?.message}`);
    }

    return data;
}

// ─── Create ─────────────────────────────────────────

export const createWorkflow = withAuth(async (user, supabase, input: CreateWorkflowInput) => {
    const tenantId = user.tenantIds[0];
    if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");

    // バリデーション
    if (!input.title || input.title.trim().length === 0) {
        throw new Error("ERR-VAL-001: タイトルは必須です");
    }
    if (input.title.length > 200) {
        throw new Error("ERR-VAL-002: タイトルは200文字以内で入力してください");
    }
    if (!input.approver_id) {
        throw new Error("ERR-VAL-003: 承認者を選択してください");
    }
    if (input.date_from && input.date_to && input.date_to < input.date_from) {
        throw new Error("ERR-VAL-004: 終了日は開始日以降にしてください");
    }

    // 承認者がテナント内に存在するか確認
    const { data: approverExists } = await supabase
        .from("user_roles")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("user_id", input.approver_id)
        .in("role", ["approver", "tenant_admin"])
        .limit(1)
        .single();

    if (!approverExists) {
        throw new Error("ERR-VAL-005: 指定された承認者が見つかりません");
    }

    const workflowNumber = await generateWorkflowNumber(supabase, tenantId);
    const status = input.status || "draft";

    const { data, error } = await supabase
        .from("workflows")
        .insert({
            workflow_number: workflowNumber,
            type: input.type,
            title: input.title.trim(),
            description: input.description || null,
            amount: input.amount ?? null,
            date_from: input.date_from || null,
            date_to: input.date_to || null,
            approver_id: input.approver_id,
            status,
            tenant_id: tenantId,
            created_by: user.id,
        })
        .select()
        .single();

    if (error) throw new Error(`ERR-SYS-001: ${error.message}`);

    await writeAuditLog(supabase, user.id, {
        tenantId,
        action: status === "submitted" ? "workflow.submit" : "workflow.create",
        resourceType: "workflow",
        resourceId: data.id,
        after: data as unknown as Record<string, unknown>,
    });

    // submitted の場合、承認者に通知
    if (status === "submitted") {
        await createNotification(supabase, {
            tenantId,
            userId: input.approver_id,
            type: "workflow_submitted",
            title: `新しい申請が届きました: ${input.title}`,
            body: `「${input.title}」が申請されました`,
            resourceType: "workflow",
            resourceId: data.id,
        });
    }

    revalidatePath("/workflows");
    return data;
});

// ─── Update (draft only) ────────────────────────────

export const updateWorkflow = withAuth(async (user, supabase, input: UpdateWorkflowInput) => {
    const tenantId = user.tenantIds[0];
    if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");

    // 現在のワークフローを取得
    const { data: current, error: fetchErr } = await supabase
        .from("workflows")
        .select("*")
        .eq("id", input.workflow_id)
        .eq("tenant_id", tenantId)
        .single();

    if (fetchErr || !current) throw new Error("ERR-WF-003: 対象の申請が見つかりません");

    // 申請者本人のみ
    if (current.created_by !== user.id) {
        throw new Error("ERR-AUTH-003: 権限がありません");
    }

    // draft または rejected のみ編集可能
    if (current.status !== "draft" && current.status !== "rejected") {
        throw new Error("ERR-WF-001: この申請は編集できません");
    }

    const updateData: Record<string, unknown> = {};
    if (input.title !== undefined) updateData.title = input.title.trim();
    if (input.description !== undefined) updateData.description = input.description;
    if (input.amount !== undefined) updateData.amount = input.amount;
    if (input.date_from !== undefined) updateData.date_from = input.date_from;
    if (input.date_to !== undefined) updateData.date_to = input.date_to;
    if (input.approver_id !== undefined) updateData.approver_id = input.approver_id;

    const { data, error } = await supabase
        .from("workflows")
        .update(updateData)
        .eq("id", input.workflow_id)
        .select()
        .single();

    if (error) throw new Error(`ERR-SYS-001: ${error.message}`);

    await writeAuditLog(supabase, user.id, {
        tenantId,
        action: "workflow.update",
        resourceType: "workflow",
        resourceId: input.workflow_id,
        before: current as unknown as Record<string, unknown>,
        after: data as unknown as Record<string, unknown>,
    });

    revalidatePath(`/workflows/${input.workflow_id}`);
    revalidatePath("/workflows");
    return data;
});

// ─── Submit / Withdraw ──────────────────────────────

export const transitionWorkflow = withAuth(async (user, supabase, input: TransitionWorkflowInput) => {
    const tenantId = user.tenantIds[0];
    if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");

    const { data: current, error: fetchErr } = await supabase
        .from("workflows")
        .select("*")
        .eq("id", input.workflow_id)
        .eq("tenant_id", tenantId)
        .single();

    if (fetchErr || !current) throw new Error("ERR-WF-003: 対象の申請が見つかりません");

    // 申請者本人のみ
    if (current.created_by !== user.id) {
        throw new Error("ERR-AUTH-003: 権限がありません");
    }

    let newStatus: WorkflowStatus;
    let auditAction: string;

    if (input.action === "submit") {
        // draft → submitted, rejected → submitted
        const currentStatus = current.status as WorkflowStatus;
        const allowed = WORKFLOW_TRANSITIONS[currentStatus] || [];
        if (!allowed.includes("submitted")) {
            throw new Error(`ERR-WF-001: ${current.status} から submitted への遷移はできません`);
        }
        // バリデーション: 送信時は必須項目チェック
        if (!current.title || current.title.trim().length === 0) {
            throw new Error("ERR-VAL-001: タイトルは必須です");
        }
        if (!current.approver_id) {
            throw new Error("ERR-VAL-003: 承認者を選択してください");
        }
        newStatus = "submitted";
        auditAction = "workflow.submit";
    } else if (input.action === "withdraw") {
        // submitted → withdrawn, rejected → withdrawn
        const currentStatus = current.status as WorkflowStatus;
        const allowed = WORKFLOW_TRANSITIONS[currentStatus] || [];
        if (!allowed.includes("withdrawn")) {
            throw new Error(`ERR-WF-001: ${current.status} から withdrawn への遷移はできません`);
        }
        newStatus = "withdrawn";
        auditAction = "workflow.withdraw";
    } else {
        throw new Error("ERR-WF-001: 不正なアクションです");
    }

    const { data, error } = await supabase
        .from("workflows")
        .update({ status: newStatus })
        .eq("id", input.workflow_id)
        .select()
        .single();

    if (error) throw new Error(`ERR-SYS-001: ${error.message}`);

    await writeAuditLog(supabase, user.id, {
        tenantId,
        action: auditAction,
        resourceType: "workflow",
        resourceId: input.workflow_id,
        before: { status: current.status },
        after: { status: newStatus },
    });

    revalidatePath(`/workflows/${input.workflow_id}`);
    revalidatePath("/workflows");
    return data;
});

// ─── Get Approvers ──────────────────────────────────

export const getApprovers = withAuth(async (user, supabase, _input: void) => {
    const tenantId = user.tenantIds[0];
    if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");

    const { data } = await supabase
        .from("user_roles")
        .select("user_id, role, profiles!inner(display_name)")
        .eq("tenant_id", tenantId)
        .in("role", ["approver", "tenant_admin"]);

    return (data ?? []).map((d) => ({
        user_id: d.user_id,
        role: d.role,
        display_name: (d.profiles as unknown as { display_name: string }).display_name,
    }));
});

// ─── Approve ────────────────────────────────────────

export const approveWorkflow = withAuth(async (user, supabase, input: { workflow_id: string }) => {
    const tenantId = user.tenantIds[0];
    if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");

    const { data: current, error: fetchErr } = await supabase
        .from("workflows")
        .select("*")
        .eq("id", input.workflow_id)
        .eq("tenant_id", tenantId)
        .single();

    if (fetchErr || !current) throw new Error("ERR-WF-003: 対象の申請が見つかりません");

    // 権限チェック: approver_id が自分、または tenant_admin
    const isTenantAdmin = hasRole(user, tenantId, ["tenant_admin"]);
    if (current.approver_id !== user.id && !isTenantAdmin) {
        throw new Error("ERR-AUTH-002: この申請を承認する権限がありません");
    }

    // 状態遷移チェック
    const currentStatus = current.status as WorkflowStatus;
    const allowed = WORKFLOW_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes("approved")) {
        throw new Error(`ERR-WF-001: ${current.status} から approved への遷移はできません`);
    }

    const { data, error } = await supabase
        .from("workflows")
        .update({
            status: "approved",
            approved_at: new Date().toISOString(),
        })
        .eq("id", input.workflow_id)
        .select()
        .single();

    if (error) throw new Error(`ERR-SYS-001: ${error.message}`);

    await writeAuditLog(supabase, user.id, {
        tenantId,
        action: "workflow.approve",
        resourceType: "workflow",
        resourceId: input.workflow_id,
        before: { status: current.status },
        after: { status: "approved" },
    });

    // 申請者に通知
    await createNotification(supabase, {
        tenantId,
        userId: current.created_by,
        type: "workflow_approved",
        title: "申請が承認されました",
        body: `「${current.title}」が承認されました`,
        resourceType: "workflow",
        resourceId: current.id,
    });

    revalidatePath(`/workflows/${input.workflow_id}`);
    revalidatePath("/workflows");
    revalidatePath("/workflows/pending");
    return data;
});

// ─── Reject ─────────────────────────────────────────

export const rejectWorkflow = withAuth(async (user, supabase, input: { workflow_id: string; reason: string }) => {
    const tenantId = user.tenantIds[0];
    if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");

    // 差戻し理由の必須チェック
    if (!input.reason || input.reason.trim().length === 0) {
        throw new Error("ERR-WF-002: 差戻し理由を入力してください");
    }

    const { data: current, error: fetchErr } = await supabase
        .from("workflows")
        .select("*")
        .eq("id", input.workflow_id)
        .eq("tenant_id", tenantId)
        .single();

    if (fetchErr || !current) throw new Error("ERR-WF-003: 対象の申請が見つかりません");

    // 権限チェック
    const isTenantAdmin = hasRole(user, tenantId, ["tenant_admin"]);
    if (current.approver_id !== user.id && !isTenantAdmin) {
        throw new Error("ERR-AUTH-002: この申請を差し戻す権限がありません");
    }

    // 状態遷移チェック
    const currentStatus = current.status as WorkflowStatus;
    const allowed = WORKFLOW_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes("rejected")) {
        throw new Error(`ERR-WF-001: ${current.status} から rejected への遷移はできません`);
    }

    const { data, error } = await supabase
        .from("workflows")
        .update({
            status: "rejected",
            rejection_reason: input.reason.trim(),
        })
        .eq("id", input.workflow_id)
        .select()
        .single();

    if (error) throw new Error(`ERR-SYS-001: ${error.message}`);

    await writeAuditLog(supabase, user.id, {
        tenantId,
        action: "workflow.reject",
        resourceType: "workflow",
        resourceId: input.workflow_id,
        before: { status: current.status },
        after: { status: "rejected" },
        metadata: { rejection_reason: input.reason.trim() },
    });

    // 申請者に通知
    await createNotification(supabase, {
        tenantId,
        userId: current.created_by,
        type: "workflow_rejected",
        title: "申請が差し戻されました",
        body: `「${current.title}」が差し戻されました。理由: ${input.reason.trim()}`,
        resourceType: "workflow",
        resourceId: current.id,
    });

    revalidatePath(`/workflows/${input.workflow_id}`);
    revalidatePath("/workflows");
    revalidatePath("/workflows/pending");
    return data;
});

// ─── Get Pending Workflows ──────────────────────────

export const getPendingWorkflows = withAuth(async (user, supabase, _input: void) => {
    const tenantId = user.tenantIds[0];
    if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");

    const isTenantAdmin = hasRole(user, tenantId, ["tenant_admin"]);

    let query = supabase
        .from("workflows")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("status", "submitted")
        .order("created_at", { ascending: false });

    // Tenant Admin は全 submitted を取得、それ以外は自分が承認者の分のみ
    if (!isTenantAdmin) {
        query = query.eq("approver_id", user.id);
    }

    const { data: workflows } = await query;

    // 申請者の表示名を取得
    const creatorIds = [...new Set((workflows ?? []).map((w) => w.created_by))];
    const { data: profilesData } = creatorIds.length > 0
        ? await supabase
            .from("profiles")
            .select("id, display_name")
            .in("id", creatorIds)
        : { data: [] };

    const profileMap: Record<string, string> = {};
    for (const p of profilesData ?? []) {
        profileMap[p.id] = p.display_name;
    }

    return {
        workflows: workflows ?? [],
        profileMap,
    };
});

