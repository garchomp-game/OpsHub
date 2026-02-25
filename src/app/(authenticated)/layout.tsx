import { requireAuth } from "@/lib/auth";
import {
    getNotifications,
    getUnreadCount,
} from "./_actions/notifications";
import AppShell from "./_components/AppShell";

export default async function AuthenticatedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const user = await requireAuth();
    const tenantId = user.tenantIds[0];
    const isTenantAdmin = !!tenantId && user.roles.some(
        (r) => r.tenantId === tenantId && r.role === "tenant_admin"
    );

    // 通知データの初期取得
    const [initialNotifications, initialUnreadCount] = await Promise.all([
        getNotifications(),
        getUnreadCount(),
    ]);

    return (
        <AppShell
            userEmail={user.email}
            isTenantAdmin={isTenantAdmin}
            initialNotificationCount={initialUnreadCount}
            initialNotifications={initialNotifications}
        >
            {children}
        </AppShell>
    );
}
