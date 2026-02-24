-- =============================================================
-- テナント論理削除（ソフトデリート）対応
-- API-A01 仕様: 論理削除（30日保持）→ 期限後に物理削除
-- =============================================================

-- ─── deleted_at カラム追加 ───────────────────────────
ALTER TABLE public.tenants ADD COLUMN deleted_at timestamptz;

-- ─── RLS ポリシー更新: deleted_at IS NULL のみ閲覧可能 ─

-- SELECT ポリシーを再作成
DROP POLICY IF EXISTS "tenant_select" ON public.tenants;
CREATE POLICY "tenant_select" ON public.tenants FOR SELECT
  USING (
    id IN (SELECT public.get_user_tenant_ids())
    AND deleted_at IS NULL
  );

-- UPDATE ポリシーを再作成（削除済みテナントは更新不可）
DROP POLICY IF EXISTS "tenant_update" ON public.tenants;
CREATE POLICY "tenant_update" ON public.tenants FOR UPDATE
  USING (
    public.has_role(id, 'tenant_admin')
    AND deleted_at IS NULL
  );
