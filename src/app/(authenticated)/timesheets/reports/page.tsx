import { requireAuth, hasRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import ReportClient from "./_components/ReportClient";

export default async function ReportsPage() {
    const user = await requireAuth();
    const supabase = await createClient();
    const tenantId = user.tenantIds[0];

    // プロジェクト一覧（フィルタ用）
    const { data: projects } = await supabase
        .from("projects")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .order("name");

    // メンバー一覧取得（フィルタ用、権限に応じて）
    const isPm = hasRole(user, tenantId, ["pm"]);
    const isTenantAdmin = hasRole(user, tenantId, ["tenant_admin"]);
    const isAccounting = hasRole(user, tenantId, ["accounting"]);
    const canViewOthers = isPm || isTenantAdmin || isAccounting;

    let members: { user_id: string; role: string; display_name: string }[] = [];
    if (canViewOthers) {
        const { data: userRoles } = await supabase
            .from("user_roles")
            .select("user_id, role, profiles!inner(display_name)")
            .eq("tenant_id", tenantId);

        const uniqueUsers = new Map<string, { role: string; display_name: string }>();
        for (const ur of userRoles ?? []) {
            uniqueUsers.set(ur.user_id, {
                role: ur.role,
                display_name: (ur.profiles as unknown as { display_name: string }).display_name,
            });
        }
        members = Array.from(uniqueUsers.entries()).map(([userId, info]) => ({
            user_id: userId,
            role: info.role,
            display_name: info.display_name,
        }));
    }

    return (
        <ReportClient
            projects={projects ?? []}
            members={members}
            canViewOthers={canViewOthers}
            currentUserId={user.id}
        />
    );
}
