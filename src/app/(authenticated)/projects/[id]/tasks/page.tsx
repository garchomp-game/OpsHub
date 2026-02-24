import { requireAuth, hasRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import KanbanBoard from "./_components/KanbanBoard";

export default async function TasksPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id: projectId } = await params;
    const user = await requireAuth();
    const supabase = await createClient();
    const tenantId = user.tenantIds[0];

    // プロジェクト取得
    const { data: project, error } = await supabase
        .from("projects")
        .select("id, name, pm_id, status, tenant_id")
        .eq("id", projectId)
        .eq("tenant_id", tenantId)
        .single();

    if (error || !project) {
        notFound();
    }

    // タスク一覧取得
    const { data: tasks } = await supabase
        .from("tasks")
        .select("*")
        .eq("project_id", projectId)
        .eq("tenant_id", tenantId)
        .order("updated_at", { ascending: false });

    // PJメンバー一覧取得
    const { data: membersRaw } = await supabase
        .from("project_members")
        .select("user_id, profiles!inner(display_name)")
        .eq("project_id", projectId);

    const members = (membersRaw ?? []).map((m) => ({
        user_id: m.user_id,
        display_name: (m.profiles as unknown as { display_name: string }).display_name,
    }));

    // 操作権限: PM or Tenant Admin（タスク作成・削除）
    const isPm = project.pm_id === user.id;
    const isTenantAdmin = hasRole(user, tenantId, ["tenant_admin"]);
    const canManage = isPm || isTenantAdmin;

    return (
        <KanbanBoard
            project={project}
            tasks={tasks ?? []}
            members={members}
            canManage={canManage}
            currentUserId={user.id}
        />
    );
}
