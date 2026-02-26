import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import WorkflowListClient from "./_components/WorkflowListClient";

export default async function WorkflowsPage({
    searchParams,
}: {
    searchParams: Promise<{ status?: string }>;
}) {
    const user = await requireAuth();
    const supabase = await createClient();
    const tenantId = user.tenantIds[0];
    const params = await searchParams;

    let query = supabase
        .from("workflows")
        .select("*", { count: "exact" })
        .eq("tenant_id", tenantId)
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });

    if (params.status) {
        query = query.eq("status", params.status);
    }

    const { data: workflows, count } = await query;

    return (
        <WorkflowListClient
            workflows={workflows ?? []}
            count={count ?? 0}
            currentStatus={params.status}
        />
    );
}
