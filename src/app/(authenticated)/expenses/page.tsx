import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth";
import ExpenseListClient from "./_components/ExpenseListClient";

export default async function ExpensesPage({
    searchParams,
}: {
    searchParams: Promise<{ category?: string }>;
}) {
    const user = await requireAuth();
    const supabase = await createClient();
    const tenantId = user.tenantIds[0];
    const params = await searchParams;

    // Accounting / Tenant Admin は全件、それ以外は自分のみ
    const isAdmin = hasRole(user, tenantId, ["accounting", "tenant_admin"]);

    let query = supabase
        .from("expenses")
        .select(`
            *,
            projects ( id, name ),
            workflows ( id, status, workflow_number ),
            profiles!expenses_created_by_fkey ( display_name )
        `, { count: "exact" })
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

    if (!isAdmin) {
        query = query.eq("created_by", user.id);
    }

    if (params.category) {
        query = query.eq("category", params.category);
    }

    const { data: expenses, count } = await query;

    return (
        <ExpenseListClient
            expenses={(expenses ?? []) as never[]}
            count={count ?? 0}
            currentCategory={params.category}
        />
    );
}
