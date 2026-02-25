// ─── 請求ステータス定義 ─────────────────────────────

export const INVOICE_STATUSES = ["draft", "sent", "paid", "cancelled"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
    draft: "下書き",
    sent: "送付済",
    paid: "入金済",
    cancelled: "キャンセル",
};

export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
    draft: "blue",
    sent: "orange",
    paid: "green",
    cancelled: "default",
};

// API-H01 ステータス遷移ルール
export const INVOICE_STATUS_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
    draft: ["sent", "cancelled"],
    sent: ["paid", "cancelled"],
    paid: [],
    cancelled: [],
};
