import { requireAuth, hasRole } from "@/lib/auth";
import { redirect } from "next/navigation";
import ExpenseSummaryClient from "./_components/ExpenseSummaryClient";
import {
    getExpenseSummaryByCategory,
    getExpenseSummaryByProject,
    getExpenseSummaryByMonth,
    getExpenseStats,
    getFilterProjects,
    type ExpenseSummaryFilters,
} from "./_actions";

export default async function ExpenseSummaryPage({
    searchParams,
}: {
    searchParams: Promise<{
        from?: string;
        to?: string;
        category?: string;
        project_id?: string;
        status?: string;
    }>;
}) {
    const user = await requireAuth();
    const tenantId = user.tenantIds[0];

    // 権限チェック: Accounting / PM / Tenant Admin のみ
    if (!hasRole(user, tenantId, ["accounting", "pm", "tenant_admin"])) {
        redirect("/dashboard");
    }

    const params = await searchParams;

    // デフォルト: 当月1日〜末日
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const filters: ExpenseSummaryFilters = {
        date_from: params.from ?? firstDay.toISOString().split("T")[0],
        date_to: params.to ?? lastDay.toISOString().split("T")[0],
        category: params.category || undefined,
        project_id: params.project_id || undefined,
        approved_only: params.status === "approved",
    };

    // プロジェクト一覧（フィルタ用）+ 集計データを並列取得
    const [byCategoryResult, byProjectResult, byMonthResult, statsResult, projectsResult] =
        await Promise.all([
            getExpenseSummaryByCategory(filters),
            getExpenseSummaryByProject(filters),
            getExpenseSummaryByMonth(filters),
            getExpenseStats(filters),
            getFilterProjects(undefined as void),
        ]);

    const projects = projectsResult.success ? projectsResult.data : [];

    return (
        <ExpenseSummaryClient
            filters={filters}
            byCategory={byCategoryResult}
            byProject={byProjectResult}
            byMonth={byMonthResult}
            stats={statsResult}
            projects={projects}
        />
    );
}
