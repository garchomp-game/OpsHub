-- =============================================================
-- 請求書テーブル マイグレーション
-- invoices (DD-DB-013) + invoice_items (DD-DB-014)
-- invoice_seq カラム + next_invoice_number RPC + RLS + Index
-- =============================================================

-- 1. tenants テーブルに採番カウンターを追加
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS invoice_seq integer NOT NULL DEFAULT 0;

-- =============================================================
-- Tables
-- =============================================================

-- ─── DD-DB-013 invoices（請求書）───────────────────────
CREATE TABLE public.invoices (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_number text NOT NULL,
  project_id     uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  client_name    text NOT NULL,
  issued_date    date NOT NULL,
  due_date       date NOT NULL,
  subtotal       numeric(12,0) NOT NULL DEFAULT 0,
  tax_rate       numeric(5,2)  NOT NULL DEFAULT 10.00,
  tax_amount     numeric(12,0) NOT NULL DEFAULT 0,
  total_amount   numeric(12,0) NOT NULL DEFAULT 0,
  status         text NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','sent','paid','cancelled')),
  notes          text,
  created_by     uuid NOT NULL REFERENCES auth.users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, invoice_number)
);

-- ─── DD-DB-014 invoice_items（請求明細）────────────────
CREATE TABLE public.invoice_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id  uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity    numeric(10,2) NOT NULL DEFAULT 1,
  unit_price  numeric(12,0) NOT NULL,
  amount      numeric(12,0) NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- =============================================================
-- Indexes
-- =============================================================

CREATE INDEX idx_invoices_tenant_status  ON public.invoices(tenant_id, status);
CREATE INDEX idx_invoices_tenant_project ON public.invoices(tenant_id, project_id);
CREATE INDEX idx_invoices_tenant_created ON public.invoices(tenant_id, created_at DESC);
CREATE INDEX idx_invoice_items_invoice   ON public.invoice_items(tenant_id, invoice_id);

-- =============================================================
-- Trigger: updated_at 自動更新
-- =============================================================

CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================================
-- RPC: next_invoice_number — 並行安全な請求書番号の採番
-- =============================================================

CREATE OR REPLACE FUNCTION public.next_invoice_number(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_seq  integer;
  v_year text;
BEGIN
  -- 行ロック取得 + 現在値読み取り
  SELECT invoice_seq INTO v_seq
  FROM public.tenants
  WHERE id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant not found: %', p_tenant_id;
  END IF;

  -- インクリメント
  v_seq := v_seq + 1;

  UPDATE public.tenants
  SET invoice_seq = v_seq
  WHERE id = p_tenant_id;

  -- 現在年を取得
  v_year := EXTRACT(YEAR FROM now())::text;

  -- INV-2026-0001 形式で返却
  RETURN 'INV-' || v_year || '-' || lpad(v_seq::text, 4, '0');
END;
$$;

-- =============================================================
-- Row Level Security
-- =============================================================

-- ─── invoices ───────────────────────────────────────────
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Accounting / TenantAdmin は全件閲覧、PM は自担当PJの請求のみ閲覧
CREATE POLICY "invoices_select" ON public.invoices FOR SELECT
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids())
    AND (
      public.has_role(tenant_id, 'accounting')
      OR public.has_role(tenant_id, 'tenant_admin')
      OR (
        public.has_role(tenant_id, 'pm')
        AND project_id IN (
          SELECT id FROM public.projects WHERE pm_id = auth.uid()
        )
      )
    )
  );

-- Accounting / TenantAdmin のみ作成可能、created_by は自分
CREATE POLICY "invoices_insert" ON public.invoices FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT public.get_user_tenant_ids())
    AND created_by = auth.uid()
    AND (
      public.has_role(tenant_id, 'accounting')
      OR public.has_role(tenant_id, 'tenant_admin')
    )
  );

-- Accounting / TenantAdmin のみ更新可能
CREATE POLICY "invoices_update" ON public.invoices FOR UPDATE
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids())
    AND (
      public.has_role(tenant_id, 'accounting')
      OR public.has_role(tenant_id, 'tenant_admin')
    )
  );

-- Accounting / TenantAdmin のみ削除可能、draft 状態のみ
CREATE POLICY "invoices_delete" ON public.invoices FOR DELETE
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids())
    AND status = 'draft'
    AND (
      public.has_role(tenant_id, 'accounting')
      OR public.has_role(tenant_id, 'tenant_admin')
    )
  );

-- ─── invoice_items ──────────────────────────────────────
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- 親 invoices の SELECT 権限に準拠
CREATE POLICY "invoice_items_select" ON public.invoice_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices
      WHERE invoices.id = invoice_items.invoice_id
        AND invoices.tenant_id = invoice_items.tenant_id
    )
  );

-- Accounting / TenantAdmin のみ作成可能
CREATE POLICY "invoice_items_insert" ON public.invoice_items FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT public.get_user_tenant_ids())
    AND (
      public.has_role(tenant_id, 'accounting')
      OR public.has_role(tenant_id, 'tenant_admin')
    )
  );

-- Accounting / TenantAdmin のみ更新可能
CREATE POLICY "invoice_items_update" ON public.invoice_items FOR UPDATE
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids())
    AND (
      public.has_role(tenant_id, 'accounting')
      OR public.has_role(tenant_id, 'tenant_admin')
    )
  );

-- Accounting / TenantAdmin のみ削除可能（CASCADE でも削除される）
CREATE POLICY "invoice_items_delete" ON public.invoice_items FOR DELETE
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids())
    AND (
      public.has_role(tenant_id, 'accounting')
      OR public.has_role(tenant_id, 'tenant_admin')
    )
  );
