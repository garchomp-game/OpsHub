"use server";

import { withAuth, writeAuditLog } from "@/lib/actions";
import { hasRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// ─── Types ──────────────────────────────────────────

const EXPENSE_CATEGORIES = ["交通費", "宿泊費", "会議費", "消耗品費", "通信費", "その他"] as const;
type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

type CreateExpenseInput = {
    category: ExpenseCategory;
    amount: number;
    expense_date: string;
    description?: string;
    project_id: string;
    approver_id: string;
    status?: "draft" | "submitted";
};

type GetExpensesInput = {
    category?: string;
};

// ─── Create ─────────────────────────────────────────

export const createExpense = withAuth(async (user, supabase, input: CreateExpenseInput) => {
    const tenantId = user.tenantIds[0];
    if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");

    // バリデーション
    if (!input.category || !EXPENSE_CATEGORIES.includes(input.category)) {
        throw new Error("ERR-VAL-001: 有効なカテゴリを選択してください");
    }
    if (!input.amount || input.amount <= 0) {
        throw new Error("ERR-VAL-002: 金額は1円以上で入力してください");
    }
    if (input.amount > 10_000_000) {
        throw new Error("ERR-VAL-002: 金額は10,000,000円以下で入力してください");
    }
    if (!input.expense_date) {
        throw new Error("ERR-VAL-003: 日付は必須です");
    }
    if (!input.project_id) {
        throw new Error("ERR-VAL-004: プロジェクトを選択してください");
    }
    if (!input.approver_id) {
        throw new Error("ERR-VAL-005: 承認者を選択してください");
    }

    // プロジェクトがテナント内に存在するか確認
    const { data: projectExists } = await supabase
        .from("projects")
        .select("id, name")
        .eq("id", input.project_id)
        .eq("tenant_id", tenantId)
        .single();

    if (!projectExists) {
        throw new Error("ERR-VAL-004: 指定されたプロジェクトが見つかりません");
    }

    // 承認者がテナント内に存在するか確認
    const { data: approverExists } = await supabase
        .from("user_roles")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("user_id", input.approver_id)
        .in("role", ["approver", "accounting", "tenant_admin"])
        .limit(1)
        .single();

    if (!approverExists) {
        throw new Error("ERR-VAL-005: 指定された承認者が見つかりません");
    }

    const wfStatus = input.status || "draft";

    // ワークフロー自動作成（type=expense）
    const { data: wfNumData, error: wfNumErr } = await supabase.rpc("next_workflow_number", {
        p_tenant_id: tenantId,
    });

    if (wfNumErr || !wfNumData) {
        throw new Error(`ERR-SYS-001: ワークフロー番号の採番に失敗しました: ${wfNumErr?.message}`);
    }

    const { data: workflow, error: wfError } = await supabase
        .from("workflows")
        .insert({
            workflow_number: wfNumData,
            type: "expense" as string,
            title: `経費申請: ${input.category} ¥${input.amount.toLocaleString()}`,
            description: input.description || null,
            amount: input.amount,
            date_from: input.expense_date,
            date_to: input.expense_date,
            approver_id: input.approver_id,
            status: wfStatus,
            tenant_id: tenantId,
            created_by: user.id,
        })
        .select()
        .single();

    if (wfError || !workflow) {
        throw new Error(`ERR-SYS-001: ワークフロー作成に失敗しました: ${wfError?.message}`);
    }

    // 経費レコード作成（workflow_id を紐付け）
    const { data: expense, error: expError } = await supabase
        .from("expenses")
        .insert({
            tenant_id: tenantId,
            workflow_id: workflow.id,
            project_id: input.project_id,
            category: input.category,
            amount: input.amount,
            expense_date: input.expense_date,
            description: input.description || null,
            created_by: user.id,
        })
        .select()
        .single();

    if (expError || !expense) {
        throw new Error(`ERR-SYS-001: 経費作成に失敗しました: ${expError?.message}`);
    }

    // 監査ログ
    await writeAuditLog(supabase, user.id, {
        tenantId,
        action: wfStatus === "submitted" ? "expense.submit" : "expense.create",
        resourceType: "expense",
        resourceId: expense.id,
        after: {
            expense: expense as unknown as Record<string, unknown>,
            workflow_id: workflow.id,
        } as unknown as Record<string, unknown>,
    });

    revalidatePath("/expenses");
    return { expense, workflow };
});

// ─── List ───────────────────────────────────────────

export const getExpenses = withAuth(async (user, supabase, input: GetExpensesInput) => {
    const tenantId = user.tenantIds[0];
    if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");

    // Accounting / Tenant Admin は全件、それ以外は自分のみ
    const isAdmin = hasRole(user, tenantId, ["accounting", "tenant_admin"]);

    let query = supabase
        .from("expenses")
        .select(`
            *,
            projects ( id, name ),
            workflows ( id, status, workflow_number ),
            profiles!expenses_created_by_fkey ( display_name )
        `)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

    if (!isAdmin) {
        query = query.eq("created_by", user.id);
    }

    if (input.category) {
        query = query.eq("category", input.category);
    }

    const { data, error } = await query;

    if (error) throw new Error(`ERR-SYS-001: ${error.message}`);

    return data ?? [];
});

// ─── Get by ID ──────────────────────────────────────

export const getExpenseById = withAuth(async (user, supabase, input: { expense_id: string }) => {
    const tenantId = user.tenantIds[0];
    if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");

    const { data, error } = await supabase
        .from("expenses")
        .select(`
            *,
            projects ( id, name ),
            workflows ( id, status, workflow_number, approver_id, rejection_reason ),
            profiles!expenses_created_by_fkey ( display_name )
        `)
        .eq("id", input.expense_id)
        .eq("tenant_id", tenantId)
        .single();

    if (error || !data) throw new Error("ERR-EXP-001: 経費が見つかりません");

    // 自分の経費 or Admin のみ
    const isAdmin = hasRole(user, tenantId, ["accounting", "tenant_admin"]);
    if (!isAdmin && data.created_by !== user.id) {
        throw new Error("ERR-AUTH-003: 権限がありません");
    }

    return data;
});

// ─── Helpers ────────────────────────────────────────

export const getProjects = withAuth(async (user, supabase, _input: void) => {
    const tenantId = user.tenantIds[0];
    if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");

    const { data } = await supabase
        .from("projects")
        .select("id, name, status")
        .eq("tenant_id", tenantId)
        .in("status", ["planning", "active"])
        .order("name");

    return data ?? [];
});

export const getApprovers = withAuth(async (user, supabase, _input: void) => {
    const tenantId = user.tenantIds[0];
    if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");

    const { data } = await supabase
        .from("user_roles")
        .select("user_id, role, profiles!inner(display_name)")
        .eq("tenant_id", tenantId)
        .in("role", ["approver", "accounting", "tenant_admin"]);

    return (data ?? []).map((d) => ({
        user_id: d.user_id,
        role: d.role,
        display_name: (d.profiles as unknown as { display_name: string }).display_name,
    }));
});
