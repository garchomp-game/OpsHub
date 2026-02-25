"use server";

import { withAuth } from "@/lib/actions";
import { hasRole } from "@/lib/auth";

// ─── Types ──────────────────────────────────────────

export type ExpenseSummaryFilters = {
    date_from: string;       // YYYY-MM-DD
    date_to: string;         // YYYY-MM-DD
    category?: string;       // カテゴリフィルタ（省略時: 全カテゴリ）
    project_id?: string;     // プロジェクトフィルタ（省略時: 全PJ）
    approved_only?: boolean; // true の場合 workflows.status = 'approved' のみ
};

export type CategorySummary = {
    category: string;
    count: number;
    total_amount: number;
    percentage: number;
};

export type ProjectSummary = {
    id: string;
    name: string;
    count: number;
    total_amount: number;
};

export type MonthlySummary = {
    month: string;        // "YYYY-MM"
    count: number;
    total_amount: number;
};

export type ExpenseStats = {
    total_amount: number;
    total_count: number;
    avg_amount: number;
    max_amount: number;
};

// ─── Helpers ────────────────────────────────────────

function assertRole(user: Parameters<Parameters<typeof withAuth>[0]>[0], tenantId: string) {
    if (!hasRole(user, tenantId, ["accounting", "pm", "tenant_admin"])) {
        throw new Error("ERR-AUTH-003: 経費集計の権限がありません");
    }
}

// ─── 1. getExpenseSummaryByCategory ─────────────────

export const getExpenseSummaryByCategory = withAuth(
    async (user, supabase, filters: ExpenseSummaryFilters): Promise<CategorySummary[]> => {
        const tenantId = user.tenantIds[0];
        if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");
        assertRole(user, tenantId);

        // バリデーション
        if (filters.date_from > filters.date_to) {
            throw new Error("ERR-VAL-010: 開始日は終了日以前を指定してください");
        }

        let query = supabase
            .from("expenses")
            .select("category, amount, workflow_id, workflows(status)")
            .eq("tenant_id", tenantId)
            .gte("expense_date", filters.date_from)
            .lte("expense_date", filters.date_to);

        if (filters.category) {
            query = query.eq("category", filters.category);
        }
        if (filters.project_id) {
            query = query.eq("project_id", filters.project_id);
        }
        if (filters.approved_only) {
            query = query.not("workflow_id", "is", null)
                .eq("workflows.status", "approved");
        }

        const { data, error } = await query;
        if (error) throw new Error(`ERR-SYS-001: ${error.message}`);

        // JS側で集計
        const categoryMap = new Map<string, { count: number; total: number }>();
        let grandTotal = 0;

        for (const row of data ?? []) {
            const existing = categoryMap.get(row.category) || { count: 0, total: 0 };
            existing.count += 1;
            existing.total += Number(row.amount);
            categoryMap.set(row.category, existing);
            grandTotal += Number(row.amount);
        }

        const result: CategorySummary[] = Array.from(categoryMap.entries())
            .map(([category, { count, total }]) => ({
                category,
                count,
                total_amount: total,
                percentage: grandTotal > 0 ? Math.round((total / grandTotal) * 1000) / 10 : 0,
            }))
            .sort((a, b) => b.total_amount - a.total_amount);

        return result;
    }
);

// ─── 2. getExpenseSummaryByProject ──────────────────

export const getExpenseSummaryByProject = withAuth(
    async (user, supabase, filters: ExpenseSummaryFilters): Promise<ProjectSummary[]> => {
        const tenantId = user.tenantIds[0];
        if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");
        assertRole(user, tenantId);

        if (filters.date_from > filters.date_to) {
            throw new Error("ERR-VAL-010: 開始日は終了日以前を指定してください");
        }

        let query = supabase
            .from("expenses")
            .select("amount, project_id, projects!inner(id, name), workflow_id, workflows(status)")
            .eq("tenant_id", tenantId)
            .gte("expense_date", filters.date_from)
            .lte("expense_date", filters.date_to);

        if (filters.category) {
            query = query.eq("category", filters.category);
        }
        if (filters.project_id) {
            query = query.eq("project_id", filters.project_id);
        }
        if (filters.approved_only) {
            query = query.not("workflow_id", "is", null)
                .eq("workflows.status", "approved");
        }

        const { data, error } = await query;
        if (error) throw new Error(`ERR-SYS-001: ${error.message}`);

        // JS側で集計
        const projectMap = new Map<string, { name: string; count: number; total: number }>();

        for (const row of data ?? []) {
            const proj = row.projects as unknown as { id: string; name: string };
            const existing = projectMap.get(proj.id) || { name: proj.name, count: 0, total: 0 };
            existing.count += 1;
            existing.total += Number(row.amount);
            projectMap.set(proj.id, existing);
        }

        return Array.from(projectMap.entries())
            .map(([id, { name, count, total }]) => ({
                id,
                name,
                count,
                total_amount: total,
            }))
            .sort((a, b) => b.total_amount - a.total_amount);
    }
);

// ─── 3. getExpenseSummaryByMonth ────────────────────

export const getExpenseSummaryByMonth = withAuth(
    async (user, supabase, filters: ExpenseSummaryFilters): Promise<MonthlySummary[]> => {
        const tenantId = user.tenantIds[0];
        if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");
        assertRole(user, tenantId);

        if (filters.date_from > filters.date_to) {
            throw new Error("ERR-VAL-010: 開始日は終了日以前を指定してください");
        }

        let query = supabase
            .from("expenses")
            .select("amount, expense_date, workflow_id, workflows(status)")
            .eq("tenant_id", tenantId)
            .gte("expense_date", filters.date_from)
            .lte("expense_date", filters.date_to);

        if (filters.category) {
            query = query.eq("category", filters.category);
        }
        if (filters.project_id) {
            query = query.eq("project_id", filters.project_id);
        }
        if (filters.approved_only) {
            query = query.not("workflow_id", "is", null)
                .eq("workflows.status", "approved");
        }

        const { data, error } = await query;
        if (error) throw new Error(`ERR-SYS-001: ${error.message}`);

        // JS側で月ごとに集計
        const monthMap = new Map<string, { count: number; total: number }>();

        for (const row of data ?? []) {
            const month = (row.expense_date as string).substring(0, 7); // "YYYY-MM"
            const existing = monthMap.get(month) || { count: 0, total: 0 };
            existing.count += 1;
            existing.total += Number(row.amount);
            monthMap.set(month, existing);
        }

        return Array.from(monthMap.entries())
            .map(([month, { count, total }]) => ({
                month,
                count,
                total_amount: total,
            }))
            .sort((a, b) => a.month.localeCompare(b.month));
    }
);

// ─── 4. getExpenseStats ─────────────────────────────

export const getExpenseStats = withAuth(
    async (user, supabase, filters: ExpenseSummaryFilters): Promise<ExpenseStats> => {
        const tenantId = user.tenantIds[0];
        if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");
        assertRole(user, tenantId);

        if (filters.date_from > filters.date_to) {
            throw new Error("ERR-VAL-010: 開始日は終了日以前を指定してください");
        }

        let query = supabase
            .from("expenses")
            .select("amount, workflow_id, workflows(status)")
            .eq("tenant_id", tenantId)
            .gte("expense_date", filters.date_from)
            .lte("expense_date", filters.date_to);

        if (filters.category) {
            query = query.eq("category", filters.category);
        }
        if (filters.project_id) {
            query = query.eq("project_id", filters.project_id);
        }
        if (filters.approved_only) {
            query = query.not("workflow_id", "is", null)
                .eq("workflows.status", "approved");
        }

        const { data, error } = await query;
        if (error) throw new Error(`ERR-SYS-001: ${error.message}`);

        const amounts = (data ?? []).map((r) => Number(r.amount));
        const total = amounts.reduce((s, a) => s + a, 0);
        const count = amounts.length;
        const avg = count > 0 ? Math.floor(total / count) : 0;
        const max = count > 0 ? Math.max(...amounts) : 0;

        return {
            total_amount: total,
            total_count: count,
            avg_amount: avg,
            max_amount: max,
        };
    }
);

// ─── Filter helpers ─────────────────────────────────

export const getFilterProjects = withAuth(async (user, supabase, _input: void) => {
    const tenantId = user.tenantIds[0];
    if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");

    const { data } = await supabase
        .from("projects")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .order("name");

    return data ?? [];
});
