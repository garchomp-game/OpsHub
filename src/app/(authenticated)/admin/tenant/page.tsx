import { requireAuth, hasRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import TenantManagement from "./_components/TenantManagement";

export default async function TenantPage() {
    const user = await requireAuth();

    // テナントIDを取得（最初のテナント）
    const tenantId = user.tenantIds[0];
    if (!tenantId) {
        return <div>テナント情報がありません。</div>;
    }

    // ロール確認
    const isItAdmin = hasRole(user, tenantId, ["it_admin"]);
    const isTenantAdmin = hasRole(user, tenantId, ["tenant_admin"]);

    if (!isItAdmin && !isTenantAdmin) {
        return <div>この画面にアクセスする権限がありません。</div>;
    }

    return (
        <TenantManagement tenantId={tenantId} isItAdmin={isItAdmin} />
    );
}
