-- =============================================================
-- ワークフロー番号の並行安全な採番
-- tenants.workflow_seq カラム + next_workflow_number 関数
-- =============================================================

-- 1. tenants テーブルにシーケンスカウンターを追加
ALTER TABLE public.tenants
  ADD COLUMN workflow_seq integer NOT NULL DEFAULT 0;

-- 既存テナントのカウンターを現在のワークフロー数で初期化
UPDATE public.tenants t
SET workflow_seq = (
  SELECT count(*)::integer
  FROM public.workflows w
  WHERE w.tenant_id = t.id
);

-- 2. 並行安全な採番関数
--    SELECT FOR UPDATE で行ロックを取得しつつカウンターをインクリメントする
CREATE OR REPLACE FUNCTION public.next_workflow_number(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_seq integer;
BEGIN
  -- 行ロック取得 + 現在値読み取り
  SELECT workflow_seq INTO v_seq
  FROM public.tenants
  WHERE id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant not found: %', p_tenant_id;
  END IF;

  -- インクリメント
  v_seq := v_seq + 1;

  UPDATE public.tenants
  SET workflow_seq = v_seq
  WHERE id = p_tenant_id;

  -- WF-001 形式で返却
  RETURN 'WF-' || lpad(v_seq::text, 3, '0');
END;
$$;
