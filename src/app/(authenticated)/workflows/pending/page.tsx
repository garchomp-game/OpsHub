import { requireAuth, hasRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PendingListClient from "./_components/PendingListClient";

export default async function PendingWorkflowsPage() {
    const user = await requireAuth();
    const supabase = await createClient();
    const tenantId = user.tenantIds[0];

    // Approver / Tenant Admin のみアクセス可
    if (!hasRole(user, tenantId, ["approver", "tenant_admin"])) {
        redirect("/workflows");
    }

    const isTenantAdmin = hasRole(user, tenantId, ["tenant_admin"]);

    let query = supabase
        .from("workflows")
        .select("*", { count: "exact" })
        .eq("tenant_id", tenantId)
        .eq("status", "submitted")
        .order("created_at", { ascending: false });

    if (!isTenantAdmin) {
        query = query.eq("approver_id", user.id);
    }

    const { data: workflows, count } = await query;

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

    return (
        <PendingListClient
            workflows={workflows ?? []}
            count={count ?? 0}
            profileMap={profileMap}
        />
    );
}
