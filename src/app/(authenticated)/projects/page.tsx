import { requireAuth, hasRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import ProjectListClient from "./_components/ProjectListClient";

export default async function ProjectsPage({
    searchParams,
}: {
    searchParams: Promise<{ status?: string; search?: string }>;
}) {
    const user = await requireAuth();
    const supabase = await createClient();
    const tenantId = user.tenantIds[0];
    const params = await searchParams;

    let query = supabase
        .from("projects")
        .select("*", { count: "exact" })
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

    if (params.status) {
        query = query.eq("status", params.status);
    }
    if (params.search) {
        query = query.ilike("name", `%${params.search}%`);
    }

    const { data: projects, count } = await query;

    // メンバー数を取得
    const projectIds = (projects ?? []).map((p) => p.id);
    const { data: memberCounts } = await supabase
        .from("project_members")
        .select("project_id")
        .in("project_id", projectIds.length > 0 ? projectIds : ["__none__"]);

    const memberCountMap: Record<string, number> = {};
    (memberCounts ?? []).forEach((m) => {
        memberCountMap[m.project_id] = (memberCountMap[m.project_id] || 0) + 1;
    });

    const canCreate = hasRole(user, tenantId, ["pm", "tenant_admin"]);

    return (
        <ProjectListClient
            projects={projects ?? []}
            count={count ?? 0}
            memberCountMap={memberCountMap}
            canCreate={canCreate}
            currentStatus={params.status}
            currentSearch={params.search}
        />
    );
}
