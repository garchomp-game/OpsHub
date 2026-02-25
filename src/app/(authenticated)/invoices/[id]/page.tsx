import { requireAuth, hasRole } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getInvoiceById, getProjects } from "../_actions";
import InvoiceForm from "../_components/InvoiceForm";
import InvoicePrintView from "./_components/InvoicePrintView";
import type { InvoiceStatus } from "../_constants";

export default async function InvoiceDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const user = await requireAuth();
    const tenantId = user.tenantIds[0];

    const isAdmin = hasRole(user, tenantId, ["accounting", "tenant_admin"]);
    const isPM = hasRole(user, tenantId, ["pm"]);

    if (!isAdmin && !isPM) {
        redirect("/dashboard");
    }

    const { id } = await params;

    const [invoiceResult, projectsResult] = await Promise.all([
        getInvoiceById({ invoice_id: id }),
        getProjects(undefined as unknown as void),
    ]);

    if (!invoiceResult.success) {
        notFound();
    }

    const { invoice, items } = invoiceResult.data;
    const projects = projectsResult.success ? projectsResult.data : [];
    const userRole = isAdmin ? "admin" : "pm";

    return (
        <>
            <div className="no-print">
                <InvoiceForm
                    mode="edit"
                    projects={projects}
                    userRole={userRole as "admin" | "pm"}
                    initialInvoice={{
                        id: invoice.id as string,
                        invoice_number: invoice.invoice_number as string,
                        client_name: invoice.client_name as string,
                        project_id: invoice.project_id as string | null,
                        issued_date: invoice.issued_date as string,
                        due_date: invoice.due_date as string,
                        tax_rate: Number(invoice.tax_rate),
                        notes: invoice.notes as string | null,
                        status: invoice.status as InvoiceStatus,
                        subtotal: Number(invoice.subtotal),
                        tax_amount: Number(invoice.tax_amount),
                        total_amount: Number(invoice.total_amount),
                    }}
                    initialItems={items.map((item: Record<string, unknown>) => ({
                        id: item.id as string,
                        description: item.description as string,
                        quantity: Number(item.quantity),
                        unit_price: Number(item.unit_price),
                        amount: Number(item.amount),
                        sort_order: Number(item.sort_order),
                    }))}
                />
            </div>

            <InvoicePrintView
                invoiceNumber={invoice.invoice_number as string}
                clientName={invoice.client_name as string}
                issuedDate={invoice.issued_date as string}
                dueDate={invoice.due_date as string}
                notes={invoice.notes as string | null}
                items={items.map((item: Record<string, unknown>) => ({
                    description: item.description as string,
                    quantity: Number(item.quantity),
                    unit_price: Number(item.unit_price),
                    amount: Number(item.amount),
                }))}
                subtotal={Number(invoice.subtotal)}
                taxRate={Number(invoice.tax_rate)}
                taxAmount={Number(invoice.tax_amount)}
                totalAmount={Number(invoice.total_amount)}
            />
        </>
    );
}
