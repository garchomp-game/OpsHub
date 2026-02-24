import { requireAuth, hasRole } from "@/lib/auth";
import { fetchAuditLogs, fetchFilterOptions } from "./_actions";
import AuditLogViewer from "./_components/AuditLogViewer";

const DEFAULT_PAGE_SIZE = 50;

export default async function AuditLogsPage() {
    const user = await requireAuth();

    const tenantId = user.tenantIds[0];
    if (!tenantId) {
        return (
            <div style={{ padding: 48, textAlign: "center" }}>
                <h2>テナントが見つかりません</h2>
            </div>
        );
    }

    // IT Admin / Tenant Admin のみアクセス可能
    if (!hasRole(user, tenantId, ["it_admin", "tenant_admin"])) {
        return (
            <div style={{ padding: 48, textAlign: "center" }}>
                <h2>アクセス権がありません</h2>
                <p>このページはIT管理者またはテナント管理者のみ閲覧できます。</p>
            </div>
        );
    }

    // サーバーサイドで初期データ取得
    const [initialData, filterOptions] = await Promise.all([
        fetchAuditLogs({ page: 1, pageSize: DEFAULT_PAGE_SIZE }),
        fetchFilterOptions(),
    ]);

    return (
        <AuditLogViewer
            initialData={initialData}
            filterOptions={filterOptions}
            defaultPageSize={DEFAULT_PAGE_SIZE}
        />
    );
}
