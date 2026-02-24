import { requireAuth, hasRole } from "@/lib/auth";
import UserManagement from "./_components/UserManagement";

export default async function UsersPage() {
    const user = await requireAuth();

    const tenantId = user.tenantIds[0];
    if (!tenantId) {
        return <div>テナント情報がありません。</div>;
    }

    const isItAdmin = hasRole(user, tenantId, ["it_admin"]);
    const isTenantAdmin = hasRole(user, tenantId, ["tenant_admin"]);

    if (!isItAdmin && !isTenantAdmin) {
        return <div>この画面にアクセスする権限がありません。</div>;
    }

    return (
        <UserManagement
            tenantId={tenantId}
            currentUserId={user.id}
            isItAdmin={isItAdmin}
        />
    );
}
