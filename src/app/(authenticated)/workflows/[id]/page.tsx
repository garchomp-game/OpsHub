import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import WorkflowDetailClient from "./_components/WorkflowDetailClient";

export default async function WorkflowDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const user = await requireAuth();
    const supabase = await createClient();
    const tenantId = user.tenantIds[0];

    const { data: workflow, error } = await supabase
        .from("workflows")
        .select("*")
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .single();

    if (error || !workflow) {
        notFound();
    }

    // 申請者本人かどうか
    const isOwner = workflow.created_by === user.id;

    // 承認者かどうか（approver_id が自分、または tenant_admin）
    const isTenantAdmin = user.roles.some(
        (r) => r.tenantId === tenantId && r.role === "tenant_admin"
    );
    const isApprover =
        (workflow.approver_id === user.id || isTenantAdmin) &&
        workflow.status === "submitted";

    // 承認者一覧（再送信時の変更用）
    const { data: approverData } = await supabase
        .from("user_roles")
        .select("user_id, role, profiles!inner(display_name)")
        .eq("tenant_id", tenantId)
        .in("role", ["approver", "tenant_admin"]);

    const approvers = (approverData ?? []).map((a) => ({
        user_id: a.user_id,
        role: a.role,
        display_name: (a.profiles as unknown as { display_name: string }).display_name,
    }));

    // 申請者・承認者の表示名を取得
    const userIds = [workflow.created_by, workflow.approver_id].filter(Boolean) as string[];
    const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds);

    const profileMap: Record<string, string> = {};
    for (const p of profilesData ?? []) {
        profileMap[p.id] = p.display_name;
    }

    return (
        <WorkflowDetailClient
            workflow={workflow}
            isOwner={isOwner}
            isApprover={isApprover}
            approvers={approvers}
            profileMap={profileMap}
        />
    );
}
