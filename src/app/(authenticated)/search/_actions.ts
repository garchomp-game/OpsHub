"use server";

import { withAuth } from "@/lib/actions";
import { hasRole } from "@/lib/auth";

// ─── Types ──────────────────────────────────────────

const SEARCH_CATEGORIES = ["all", "workflows", "projects", "tasks", "expenses"] as const;
type SearchCategory = (typeof SEARCH_CATEGORIES)[number];

type SearchAllInput = {
    query: string;
    category?: SearchCategory;
    page?: number;
};

export type SearchResult = {
    id: string;
    category: "workflow" | "project" | "task" | "expense";
    title: string;
    description?: string;
    status: string;
    createdAt: string;
    link: string;
    metadata?: {
        amount?: number;
        projectId?: string;
        expenseCategory?: string;
    };
};

export type SearchAllResponse = {
    results: SearchResult[];
    counts: {
        all: number;
        workflows: number;
        projects: number;
        tasks: number;
        expenses: number;
    };
    page: number;
    hasMore: boolean;
};

// ─── Helpers ────────────────────────────────────────

/** SQL LIKE のメタ文字をエスケープ */
function escapeLikeQuery(query: string): string {
    return query.replace(/[%_\\]/g, (char) => `\\${char}`);
}

// ─── searchAll ──────────────────────────────────────

export const searchAll = withAuth(async (user, supabase, input: SearchAllInput): Promise<SearchAllResponse> => {
    const tenantId = user.tenantIds[0];
    if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");

    // バリデーション
    const query = (input.query ?? "").trim();
    if (!query) {
        throw new Error("ERR-VAL-001: 検索キーワードを入力してください");
    }
    if (query.length > 100) {
        throw new Error("ERR-VAL-002: 検索キーワードは100文字以下で入力してください");
    }

    const category: SearchCategory = input.category ?? "all";
    if (!SEARCH_CATEGORIES.includes(category)) {
        throw new Error("ERR-VAL-003: 無効なカテゴリです");
    }

    const page = input.page ?? 1;
    if (!Number.isInteger(page) || page < 1) {
        throw new Error("ERR-VAL-004: 無効なページ番号です");
    }

    const escaped = escapeLikeQuery(query);
    const pattern = `%${escaped}%`;

    // 件数制限
    const limitPerCategory = category === "all" ? 10 : 20;
    const offset = category === "all" ? 0 : (page - 1) * limitPerCategory;

    // 経費の権限チェック
    const isExpenseAdmin = hasRole(user, tenantId, ["accounting", "tenant_admin"]);

    // ─── カテゴリ別検索関数 ────────────────────────

    const searchWorkflows = async () => {
        if (category !== "all" && category !== "workflows") return { items: [], count: 0 };
        const q = supabase
            .from("workflows")
            .select("id, title, description, status, created_at", { count: "exact" })
            .eq("tenant_id", tenantId)
            .or(`title.ilike.${pattern},description.ilike.${pattern}`)
            .order("created_at", { ascending: false })
            .range(offset, offset + limitPerCategory - 1);
        // RLS handles tenant filtering
        const { data, count, error } = await q;
        if (error) throw new Error(`ERR-SYS-001: ${error.message}`);
        return {
            items: (data ?? []).map((w): SearchResult => ({
                id: w.id,
                category: "workflow",
                title: w.title,
                description: w.description ?? undefined,
                status: w.status,
                createdAt: w.created_at,
                link: `/workflows/${w.id}`,
            })),
            count: count ?? 0,
        };
    };

    const searchProjects = async () => {
        if (category !== "all" && category !== "projects") return { items: [], count: 0 };
        const { data, count, error } = await supabase
            .from("projects")
            .select("id, name, description, status, created_at", { count: "exact" })
            .eq("tenant_id", tenantId)
            .or(`name.ilike.${pattern},description.ilike.${pattern}`)
            .order("created_at", { ascending: false })
            .range(offset, offset + limitPerCategory - 1);
        if (error) throw new Error(`ERR-SYS-001: ${error.message}`);
        return {
            items: (data ?? []).map((p): SearchResult => ({
                id: p.id,
                category: "project",
                title: p.name,
                description: p.description ?? undefined,
                status: p.status,
                createdAt: p.created_at,
                link: `/projects/${p.id}`,
            })),
            count: count ?? 0,
        };
    };

    const searchTasks = async () => {
        if (category !== "all" && category !== "tasks") return { items: [], count: 0 };
        const { data, count, error } = await supabase
            .from("tasks")
            .select("id, title, status, created_at, project_id", { count: "exact" })
            .eq("tenant_id", tenantId)
            .ilike("title", pattern)
            .order("created_at", { ascending: false })
            .range(offset, offset + limitPerCategory - 1);
        if (error) throw new Error(`ERR-SYS-001: ${error.message}`);
        return {
            items: (data ?? []).map((t): SearchResult => ({
                id: t.id,
                category: "task",
                title: t.title,
                status: t.status,
                createdAt: t.created_at,
                link: `/projects/${t.project_id}/tasks`,
                metadata: { projectId: t.project_id },
            })),
            count: count ?? 0,
        };
    };

    const searchExpenses = async () => {
        if (category !== "all" && category !== "expenses") return { items: [], count: 0 };
        let q = supabase
            .from("expenses")
            .select("id, description, category, amount, expense_date, created_at, workflow_id, workflows(status)", { count: "exact" })
            .eq("tenant_id", tenantId)
            .ilike("description", pattern)
            .order("created_at", { ascending: false })
            .range(offset, offset + limitPerCategory - 1);

        // Member / Approver / PM は自分の経費のみ
        if (!isExpenseAdmin) {
            q = q.eq("created_by", user.id);
        }

        const { data, count, error } = await q;
        if (error) throw new Error(`ERR-SYS-001: ${error.message}`);
        return {
            items: (data ?? []).map((e): SearchResult => ({
                id: e.id,
                category: "expense",
                title: e.description ?? "",
                status: (e.workflows as unknown as { status: string } | null)?.status ?? "—",
                createdAt: e.created_at,
                link: `/expenses`,
                metadata: {
                    amount: e.amount,
                    expenseCategory: e.category,
                },
            })),
            count: count ?? 0,
        };
    };

    // ─── 並列実行 ────────────────────────────────

    const [wf, pj, tk, ex] = await Promise.all([
        searchWorkflows(),
        searchProjects(),
        searchTasks(),
        searchExpenses(),
    ]);

    // 結果を統合
    const allResults = [...wf.items, ...pj.items, ...tk.items, ...ex.items];
    const counts = {
        all: wf.count + pj.count + tk.count + ex.count,
        workflows: wf.count,
        projects: pj.count,
        tasks: tk.count,
        expenses: ex.count,
    };

    // hasMore 判定
    let hasMore = false;
    if (category === "all") {
        hasMore = wf.count > 10 || pj.count > 10 || tk.count > 10 || ex.count > 10;
    } else {
        const total = counts[category];
        hasMore = offset + limitPerCategory < total;
    }

    return {
        results: allResults,
        counts,
        page,
        hasMore,
    };
});
