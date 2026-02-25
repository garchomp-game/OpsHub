import { requireAuth, hasRole } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getProjects } from "../_actions";
import InvoiceForm from "../_components/InvoiceForm";

export default async function NewInvoicePage() {
    const user = await requireAuth();
    const tenantId = user.tenantIds[0];

    // Accounting / Tenant Admin のみ作成可能
    const isAdmin = hasRole(user, tenantId, ["accounting", "tenant_admin"]);
    if (!isAdmin) {
        redirect("/invoices");
    }

    const projectsResult = await getProjects(undefined as unknown as void);
    const projects = projectsResult.success ? projectsResult.data : [];

    return (
        <InvoiceForm
            mode="new"
            projects={projects}
            userRole="admin"
        />
    );
}
