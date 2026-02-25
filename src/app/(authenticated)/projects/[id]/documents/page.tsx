import { requireAuth, hasRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { getDocuments } from "./_actions";
import DocumentListClient from "./_components/DocumentListClient";

export default async function DocumentsPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const user = await requireAuth();
    const supabase = await createClient();
    const tenantId = user.tenantIds[0];

    // プロジェクト存在確認
    const { data: project, error } = await supabase
        .from("projects")
        .select("id, name")
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .single();

    if (error || !project) {
        notFound();
    }

    // ドキュメント一覧取得
    const result = await getDocuments({ project_id: id });
    const documents = result.success ? result.data : [];

    // 操作権限: PM or Tenant Admin
    const canManage =
        hasRole(user, tenantId, ["pm", "tenant_admin"]);

    return (
        <DocumentListClient
            projectId={id}
            projectName={project.name}
            documents={documents}
            canManage={canManage}
        />
    );
}
