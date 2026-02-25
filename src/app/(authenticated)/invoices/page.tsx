import { requireAuth, hasRole } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getInvoices, getProjects } from "./_actions";
import InvoiceListClient from "./_components/InvoiceListClient";

export default async function InvoicesPage({
    searchParams,
}: {
    searchParams: Promise<{
        status?: string;
        project_id?: string;
        from?: string;
        to?: string;
    }>;
}) {
    const user = await requireAuth();
    const tenantId = user.tenantIds[0];

    // ロールチェック: Accounting / Tenant Admin / PM のみ
    const isAdmin = hasRole(user, tenantId, ["accounting", "tenant_admin"]);
    const isPM = hasRole(user, tenantId, ["pm"]);

    if (!isAdmin && !isPM) {
        redirect("/dashboard");
    }

    const params = await searchParams;

    // データ取得
    const [invoicesResult, projectsResult] = await Promise.all([
        getInvoices({
            status: params.status,
            project_id: params.project_id,
            from: params.from,
            to: params.to,
        }),
        getProjects(undefined as unknown as void),
    ]);

    const invoices = invoicesResult.success ? invoicesResult.data.data : [];
    const totalCount = invoicesResult.success ? invoicesResult.data.count : 0;
    const projects = projectsResult.success ? projectsResult.data : [];

    return (
        <InvoiceListClient
            invoices={invoices}
            totalCount={totalCount}
            projects={projects}
            isAdmin={isAdmin}
            currentFilters={{
                status: params.status,
                project_id: params.project_id,
                from: params.from,
                to: params.to,
            }}
        />
    );
}
