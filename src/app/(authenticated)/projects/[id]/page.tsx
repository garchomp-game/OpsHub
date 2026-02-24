import { requireAuth, hasRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ProjectDetailClient from "./_components/ProjectDetailClient";

export default async function ProjectDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const user = await requireAuth();
    const supabase = await createClient();
    const tenantId = user.tenantIds[0];

    // プロジェクト取得
    const { data: project, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .single();

    if (error || !project) {
        notFound();
    }

    // メンバー取得
    const { data: membersRaw } = await supabase
        .from("project_members")
        .select("id, user_id, created_at, profiles!inner(display_name)")
        .eq("project_id", id);

    const members = (membersRaw ?? []).map((m) => ({
        id: m.id,
        user_id: m.user_id,
        created_at: m.created_at,
        display_name: (m.profiles as unknown as { display_name: string }).display_name,
    }));

    // タスク統計取得
    const { data: tasks } = await supabase
        .from("tasks")
        .select("id, status")
        .eq("project_id", id);

    const taskStats = {
        total: tasks?.length ?? 0,
        todo: tasks?.filter((t) => t.status === "todo").length ?? 0,
        in_progress: tasks?.filter((t) => t.status === "in_progress").length ?? 0,
        done: tasks?.filter((t) => t.status === "done").length ?? 0,
    };

    // テナント内のユーザー一覧（メンバー追加用）
    const { data: tenantUsersRaw } = await supabase
        .from("user_roles")
        .select("user_id, role, profiles!inner(display_name)")
        .eq("tenant_id", tenantId);

    const tenantUsers = (tenantUsersRaw ?? []).map((u) => ({
        user_id: u.user_id,
        role: u.role,
        display_name: (u.profiles as unknown as { display_name: string }).display_name,
    }));

    // PMの表示名を取得
    const { data: pmProfile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", project.pm_id)
        .single();

    const pmDisplayName = pmProfile?.display_name ?? project.pm_id;

    // 操作権限: PM or Tenant Admin
    const canEdit =
        hasRole(user, tenantId, ["tenant_admin"]) ||
        project.pm_id === user.id;

    return (
        <ProjectDetailClient
            project={project}
            members={members}
            taskStats={taskStats}
            tenantUsers={tenantUsers}
            canEdit={canEdit}
            currentUserId={user.id}
            pmDisplayName={pmDisplayName}
        />
    );
}
