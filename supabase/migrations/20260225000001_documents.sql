-- =============================================================
-- ドキュメント管理 マイグレーション
-- documents (DD-DB-015)
-- RLS + Index + Storage バケット + ストレージポリシー
-- =============================================================

-- =============================================================
-- Table
-- =============================================================

-- ─── DD-DB-015 documents（ドキュメント）───────────────────
CREATE TABLE public.documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  project_id   uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  name         text NOT NULL,
  file_path    text NOT NULL,
  file_size    bigint NOT NULL DEFAULT 0,
  mime_type    text NOT NULL,
  uploaded_by  uuid NOT NULL REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- =============================================================
-- Indexes
-- =============================================================

CREATE INDEX idx_documents_tenant_project ON public.documents(tenant_id, project_id);

-- =============================================================
-- Trigger: updated_at 自動更新
-- =============================================================

CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================================
-- Row Level Security
-- =============================================================

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- プロジェクトメンバーは閲覧可能（project_id が NULL の場合はテナントメンバー全員）
CREATE POLICY "documents_select" ON public.documents FOR SELECT
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids())
    AND (
      project_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.project_members
        WHERE project_members.project_id = documents.project_id
          AND project_members.user_id = auth.uid()
      )
      OR public.has_role(tenant_id, 'pm')
      OR public.has_role(tenant_id, 'tenant_admin')
    )
  );

-- PM / Tenant Admin のみアップロード可能
CREATE POLICY "documents_insert" ON public.documents FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT public.get_user_tenant_ids())
    AND uploaded_by = auth.uid()
    AND (
      public.has_role(tenant_id, 'pm')
      OR public.has_role(tenant_id, 'tenant_admin')
    )
  );

-- PM / Tenant Admin のみ削除可能
CREATE POLICY "documents_delete" ON public.documents FOR DELETE
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids())
    AND (
      public.has_role(tenant_id, 'pm')
      OR public.has_role(tenant_id, 'tenant_admin')
    )
  );

-- =============================================================
-- Supabase Storage: バケット作成
-- =============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('project-documents', 'project-documents', false);

-- =============================================================
-- Storage ポリシー: テナント内ユーザーのみアクセス
-- =============================================================

-- SELECT: テナントメンバーは自テナントのファイルを閲覧可能
CREATE POLICY "project_documents_select" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'project-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT t.id::text FROM public.tenants t
      WHERE t.id IN (SELECT public.get_user_tenant_ids())
    )
  );

-- INSERT: PM / Tenant Admin のみアップロード可能
CREATE POLICY "project_documents_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'project-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT t.id::text FROM public.tenants t
      WHERE t.id IN (SELECT public.get_user_tenant_ids())
        AND (
          public.has_role(t.id, 'pm')
          OR public.has_role(t.id, 'tenant_admin')
        )
    )
  );

-- DELETE: PM / Tenant Admin のみ削除可能
CREATE POLICY "project_documents_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'project-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT t.id::text FROM public.tenants t
      WHERE t.id IN (SELECT public.get_user_tenant_ids())
        AND (
          public.has_role(t.id, 'pm')
          OR public.has_role(t.id, 'tenant_admin')
        )
    )
  );
