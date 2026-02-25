"use server";

import { withAuth, writeAuditLog } from "@/lib/actions";
import { hasRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { INVOICE_STATUS_TRANSITIONS, type InvoiceStatus } from "./_constants";

// ─── Types ──────────────────────────────────────────

type GetInvoicesInput = {
    status?: string;
    project_id?: string;
    from?: string;
    to?: string;
};

type DeleteInvoiceInput = {
    invoice_id: string;
};

type UpdateInvoiceStatusInput = {
    id: string;
    status: "sent" | "paid" | "cancelled";
};

type CreateInvoiceItemInput = {
    description: string;
    quantity: number;
    unit_price: number;
};

type CreateInvoiceInput = {
    client_name: string;
    project_id?: string;
    issued_date: string;
    due_date: string;
    tax_rate?: number;
    notes?: string;
    items: CreateInvoiceItemInput[];
};

type UpdateInvoiceItemInput = {
    id?: string;
    description: string;
    quantity: number;
    unit_price: number;
};

type UpdateInvoiceInput = {
    id: string;
    client_name: string;
    project_id?: string;
    issued_date: string;
    due_date: string;
    tax_rate?: number;
    notes?: string;
    items: UpdateInvoiceItemInput[];
};

// ─── createInvoice ──────────────────────────────────

export const createInvoice = withAuth(async (user, supabase, input: CreateInvoiceInput) => {
    const tenantId = user.tenantIds[0];
    if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");

    const isAdmin = hasRole(user, tenantId, ["accounting", "tenant_admin"]);
    if (!isAdmin) {
        throw new Error("ERR-AUTH-004: 請求書の作成権限がありません");
    }

    // バリデーション
    if (!input.client_name?.trim()) {
        throw new Error("ERR-VAL-H01: 取引先名は必須です");
    }
    if (input.client_name.length > 200) {
        throw new Error("ERR-VAL-H01: 取引先名は200文字以内で入力してください");
    }
    if (!input.issued_date) {
        throw new Error("ERR-VAL-H02: 発行日は必須です");
    }
    if (!input.due_date) {
        throw new Error("ERR-VAL-H03: 支払期日は必須です");
    }
    if (input.due_date < input.issued_date) {
        throw new Error("ERR-VAL-H03: 支払期日は発行日以降の日付を指定してください");
    }
    if (!input.items || input.items.length === 0) {
        throw new Error("ERR-VAL-H05: 明細は1行以上必要です");
    }

    // 明細バリデーション
    for (const item of input.items) {
        if (!item.description?.trim()) {
            throw new Error("ERR-VAL-H06: 品目名は必須です");
        }
        if (!item.quantity || item.quantity <= 0) {
            throw new Error("ERR-VAL-H07: 数量は0より大きい値を入力してください");
        }
        if (item.unit_price < 0) {
            throw new Error("ERR-VAL-H08: 単価は0以上で入力してください");
        }
    }

    // プロジェクト存在確認（指定時）
    if (input.project_id) {
        const { data: projectExists } = await supabase
            .from("projects")
            .select("id")
            .eq("id", input.project_id)
            .eq("tenant_id", tenantId)
            .single();
        if (!projectExists) {
            throw new Error("ERR-VAL-H04: 指定されたプロジェクトが見つかりません");
        }
    }

    // 請求番号採番
    const { data: invoiceNumber, error: seqError } = await supabase.rpc("next_invoice_number", {
        p_tenant_id: tenantId,
    });

    if (seqError || !invoiceNumber) {
        throw new Error(`ERR-SYS-001: 請求番号の採番に失敗しました: ${seqError?.message}`);
    }

    // 金額計算
    const taxRate = input.tax_rate ?? 10;
    const subtotal = input.items.reduce(
        (sum, item) => sum + Math.round(item.quantity * item.unit_price),
        0
    );
    const taxAmount = Math.floor(subtotal * taxRate / 100);
    const totalAmount = subtotal + taxAmount;

    // invoices INSERT
    const { data: invoice, error: insertError } = await supabase
        .from("invoices")
        .insert({
            tenant_id: tenantId,
            invoice_number: invoiceNumber,
            client_name: input.client_name.trim(),
            project_id: input.project_id || null,
            issued_date: input.issued_date,
            due_date: input.due_date,
            subtotal,
            tax_rate: taxRate,
            tax_amount: taxAmount,
            total_amount: totalAmount,
            status: "draft",
            notes: input.notes || null,
            created_by: user.id,
        })
        .select()
        .single();

    if (insertError || !invoice) {
        throw new Error(`ERR-SYS-001: 請求書の作成に失敗しました: ${insertError?.message}`);
    }

    // invoice_items 一括 INSERT
    const itemsToInsert = input.items.map((item, index) => ({
        tenant_id: tenantId,
        invoice_id: invoice.id,
        description: item.description.trim(),
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: Math.round(item.quantity * item.unit_price),
        sort_order: index,
    }));

    const { data: items, error: itemsError } = await supabase
        .from("invoice_items")
        .insert(itemsToInsert)
        .select();

    if (itemsError) {
        throw new Error(`ERR-SYS-001: 明細の作成に失敗しました: ${itemsError.message}`);
    }

    // 監査ログ
    await writeAuditLog(supabase, user.id, {
        tenantId,
        action: "invoice.create",
        resourceType: "invoice",
        resourceId: invoice.id,
        after: {
            invoice: invoice as unknown as Record<string, unknown>,
            items: items as unknown as Record<string, unknown>,
        } as unknown as Record<string, unknown>,
    });

    revalidatePath("/invoices");
    return { invoice, items: items ?? [] };
});

// ─── updateInvoice ──────────────────────────────────

export const updateInvoice = withAuth(async (user, supabase, input: UpdateInvoiceInput) => {
    const tenantId = user.tenantIds[0];
    if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");

    const isAdmin = hasRole(user, tenantId, ["accounting", "tenant_admin"]);
    if (!isAdmin) {
        throw new Error("ERR-AUTH-004: 請求書の編集権限がありません");
    }

    // 既存請求書取得
    const { data: existing, error: fetchError } = await supabase
        .from("invoices")
        .select("*, invoice_items(*)")
        .eq("id", input.id)
        .eq("tenant_id", tenantId)
        .single();

    if (fetchError || !existing) {
        throw new Error("ERR-INV-001: 請求書が見つかりません");
    }
    if (existing.status !== "draft") {
        throw new Error("ERR-INV-002: 下書き以外の請求書は編集できません");
    }

    // バリデーション（createInvoice と同一）
    if (!input.client_name?.trim()) {
        throw new Error("ERR-VAL-H01: 取引先名は必須です");
    }
    if (input.client_name.length > 200) {
        throw new Error("ERR-VAL-H01: 取引先名は200文字以内で入力してください");
    }
    if (!input.issued_date) {
        throw new Error("ERR-VAL-H02: 発行日は必須です");
    }
    if (!input.due_date) {
        throw new Error("ERR-VAL-H03: 支払期日は必須です");
    }
    if (input.due_date < input.issued_date) {
        throw new Error("ERR-VAL-H03: 支払期日は発行日以降の日付を指定してください");
    }
    if (!input.items || input.items.length === 0) {
        throw new Error("ERR-VAL-H05: 明細は1行以上必要です");
    }

    for (const item of input.items) {
        if (!item.description?.trim()) {
            throw new Error("ERR-VAL-H06: 品目名は必須です");
        }
        if (!item.quantity || item.quantity <= 0) {
            throw new Error("ERR-VAL-H07: 数量は0より大きい値を入力してください");
        }
        if (item.unit_price < 0) {
            throw new Error("ERR-VAL-H08: 単価は0以上で入力してください");
        }
    }

    if (input.project_id) {
        const { data: projectExists } = await supabase
            .from("projects")
            .select("id")
            .eq("id", input.project_id)
            .eq("tenant_id", tenantId)
            .single();
        if (!projectExists) {
            throw new Error("ERR-VAL-H04: 指定されたプロジェクトが見つかりません");
        }
    }

    // 金額再計算
    const taxRate = input.tax_rate ?? 10;
    const subtotal = input.items.reduce(
        (sum, item) => sum + Math.round(item.quantity * item.unit_price),
        0
    );
    const taxAmount = Math.floor(subtotal * taxRate / 100);
    const totalAmount = subtotal + taxAmount;

    // 既存明細を全削除
    await supabase
        .from("invoice_items")
        .delete()
        .eq("invoice_id", input.id)
        .eq("tenant_id", tenantId);

    // 新しい明細で再INSERT
    const itemsToInsert = input.items.map((item, index) => ({
        tenant_id: tenantId,
        invoice_id: input.id,
        description: item.description.trim(),
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: Math.round(item.quantity * item.unit_price),
        sort_order: index,
    }));

    const { data: newItems, error: itemsError } = await supabase
        .from("invoice_items")
        .insert(itemsToInsert)
        .select();

    if (itemsError) {
        throw new Error(`ERR-SYS-001: 明細の更新に失敗しました: ${itemsError.message}`);
    }

    // invoices テーブル更新
    const { data: updated, error: updateError } = await supabase
        .from("invoices")
        .update({
            client_name: input.client_name.trim(),
            project_id: input.project_id || null,
            issued_date: input.issued_date,
            due_date: input.due_date,
            subtotal,
            tax_rate: taxRate,
            tax_amount: taxAmount,
            total_amount: totalAmount,
            notes: input.notes || null,
        })
        .eq("id", input.id)
        .select()
        .single();

    if (updateError || !updated) {
        throw new Error(`ERR-SYS-001: 請求書の更新に失敗しました: ${updateError?.message}`);
    }

    // 監査ログ（before/after）
    await writeAuditLog(supabase, user.id, {
        tenantId,
        action: "invoice.update",
        resourceType: "invoice",
        resourceId: input.id,
        before: {
            invoice: existing as unknown as Record<string, unknown>,
            items: existing.invoice_items as unknown as Record<string, unknown>,
        } as unknown as Record<string, unknown>,
        after: {
            invoice: updated as unknown as Record<string, unknown>,
            items: newItems as unknown as Record<string, unknown>,
        } as unknown as Record<string, unknown>,
    });

    revalidatePath("/invoices");
    return { invoice: updated, items: newItems ?? [] };
});

// ─── getInvoiceById ─────────────────────────────────

export const getInvoiceById = withAuth(async (user, supabase, input: { invoice_id: string }) => {
    const tenantId = user.tenantIds[0];
    if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");

    const { data: invoice, error } = await supabase
        .from("invoices")
        .select(`
            *,
            invoice_items ( id, description, quantity, unit_price, amount, sort_order ),
            projects ( id, name ),
            profiles!invoices_created_by_fkey ( display_name )
        `)
        .eq("id", input.invoice_id)
        .eq("tenant_id", tenantId)
        .single();

    if (error || !invoice) {
        throw new Error("ERR-INV-001: 請求書が見つかりません");
    }

    // PM は自分の担当プロジェクトの請求のみ閲覧可
    const isAdmin = hasRole(user, tenantId, ["accounting", "tenant_admin"]);
    if (!isAdmin) {
        const isPM = hasRole(user, tenantId, ["pm"]);
        if (!isPM) {
            throw new Error("ERR-AUTH-004: 権限がありません");
        }
        // PM の場合、project_id が自担当PJか確認
        if (invoice.project_id) {
            const { data: project } = await supabase
                .from("projects")
                .select("id")
                .eq("id", invoice.project_id)
                .eq("pm_id", user.id)
                .single();
            if (!project) {
                throw new Error("ERR-AUTH-004: 権限がありません");
            }
        } else {
            // プロジェクト未紐付の請求はPMからはアクセス不可
            throw new Error("ERR-AUTH-004: 権限がありません");
        }
    }

    return {
        invoice,
        items: (invoice.invoice_items ?? []).sort(
            (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
        ),
    };
});

// ─── getInvoices ────────────────────────────────────

export const getInvoices = withAuth(async (user, supabase, input: GetInvoicesInput) => {
    const tenantId = user.tenantIds[0];
    if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");

    const isAdmin = hasRole(user, tenantId, ["accounting", "tenant_admin"]);
    const isPM = hasRole(user, tenantId, ["pm"]);

    // PM でも Admin でもなければアクセス不可
    if (!isAdmin && !isPM) {
        throw new Error("ERR-AUTH-004: 請求一覧の閲覧権限がありません");
    }

    let query = supabase
        .from("invoices")
        .select(`
            *,
            projects ( id, name ),
            profiles!invoices_created_by_fkey ( display_name )
        `, { count: "exact" })
        .eq("tenant_id", tenantId)
        .order("issued_date", { ascending: false })
        .order("created_at", { ascending: false });

    // PM: 自分が PM のプロジェクトに紐づく請求のみ
    if (!isAdmin && isPM) {
        const { data: myProjects } = await supabase
            .from("projects")
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("pm_id", user.id);

        const projectIds = (myProjects ?? []).map((p) => p.id);
        if (projectIds.length === 0) {
            // PM だが管理PJがない → 空を返す
            return { data: [], count: 0 };
        }
        query = query.in("project_id", projectIds);
    }

    // フィルタ適用
    if (input.status) {
        query = query.eq("status", input.status);
    }
    if (input.project_id) {
        query = query.eq("project_id", input.project_id);
    }
    if (input.from) {
        query = query.gte("issued_date", input.from);
    }
    if (input.to) {
        query = query.lte("issued_date", input.to);
    }

    const { data, count, error } = await query;

    if (error) throw new Error(`ERR-SYS-001: ${error.message}`);

    return { data: data ?? [], count: count ?? 0 };
});

// ─── deleteInvoice ──────────────────────────────────

export const deleteInvoice = withAuth(async (user, supabase, input: DeleteInvoiceInput) => {
    const tenantId = user.tenantIds[0];
    if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");

    const isAdmin = hasRole(user, tenantId, ["accounting", "tenant_admin"]);
    if (!isAdmin) {
        throw new Error("ERR-AUTH-004: 削除権限がありません");
    }

    // 請求書取得
    const { data: invoice, error: fetchError } = await supabase
        .from("invoices")
        .select("*, invoice_items(*)")
        .eq("id", input.invoice_id)
        .eq("tenant_id", tenantId)
        .single();

    if (fetchError || !invoice) {
        throw new Error("ERR-INV-001: 請求書が見つかりません");
    }

    if (invoice.status !== "draft") {
        throw new Error("ERR-INV-004: 下書き以外の請求書は削除できません");
    }

    // 削除（invoice_items は CASCADE で自動削除）
    const { error: deleteError } = await supabase
        .from("invoices")
        .delete()
        .eq("id", input.invoice_id);

    if (deleteError) {
        throw new Error(`ERR-SYS-001: ${deleteError.message}`);
    }

    // 監査ログ
    await writeAuditLog(supabase, user.id, {
        tenantId,
        action: "invoice.delete",
        resourceType: "invoice",
        resourceId: input.invoice_id,
        before: {
            invoice: invoice as unknown as Record<string, unknown>,
            items: invoice.invoice_items as unknown as Record<string, unknown>,
        } as unknown as Record<string, unknown>,
    });

    revalidatePath("/invoices");
    return { success: true };
});

// ─── updateInvoiceStatus ────────────────────────────

export const updateInvoiceStatus = withAuth(async (user, supabase, input: UpdateInvoiceStatusInput) => {
    const tenantId = user.tenantIds[0];
    if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");

    const isAdmin = hasRole(user, tenantId, ["accounting", "tenant_admin"]);
    if (!isAdmin) {
        throw new Error("ERR-AUTH-004: ステータス変更の権限がありません");
    }

    // 請求書取得
    const { data: invoice, error: fetchError } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", input.id)
        .eq("tenant_id", tenantId)
        .single();

    if (fetchError || !invoice) {
        throw new Error("ERR-INV-001: 請求書が見つかりません");
    }

    // ステータス遷移バリデーション
    const currentStatus = invoice.status as InvoiceStatus;
    const allowedTransitions = INVOICE_STATUS_TRANSITIONS[currentStatus] ?? [];
    if (!allowedTransitions.includes(input.status)) {
        throw new Error("ERR-INV-003: 無効なステータス遷移です");
    }

    // 更新
    const { data: updated, error: updateError } = await supabase
        .from("invoices")
        .update({ status: input.status })
        .eq("id", input.id)
        .select()
        .single();

    if (updateError || !updated) {
        throw new Error(`ERR-SYS-001: ${updateError?.message}`);
    }

    // 監査ログ
    await writeAuditLog(supabase, user.id, {
        tenantId,
        action: "invoice.status_change",
        resourceType: "invoice",
        resourceId: input.id,
        before: { status: currentStatus } as unknown as Record<string, unknown>,
        after: { status: input.status } as unknown as Record<string, unknown>,
    });

    revalidatePath("/invoices");
    return { invoice: updated };
});

// ─── getProjects（フィルタ用） ──────────────────────

export const getProjects = withAuth(async (user, supabase, _input: void) => {
    const tenantId = user.tenantIds[0];
    if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");

    const { data } = await supabase
        .from("projects")
        .select("id, name, status")
        .eq("tenant_id", tenantId)
        .in("status", ["planning", "active"])
        .order("name");

    return data ?? [];
});
