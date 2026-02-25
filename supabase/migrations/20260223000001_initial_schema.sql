-- =============================================================
-- OpsHub Initial Schema Migration
-- Based on: detail/db/index.md + detail/rls/index.md
-- =============================================================

-- ─── Helper Functions (table-independent) ───────────

-- updated_at 自動更新トリガー関数
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- audit_logs の UPDATE/DELETE 禁止トリガー関数
CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs table does not allow UPDATE or DELETE';
END;
$$;

-- =============================================================
-- Tables
-- =============================================================

-- ─── DD-DB-001 tenants ──────────────────────────────
CREATE TABLE public.tenants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  settings    jsonb DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── DD-DB-002 user_roles ───────────────────────────
CREATE TABLE public.user_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('member','approver','pm','accounting','it_admin','tenant_admin')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id, role)
);

CREATE INDEX idx_user_roles_tenant_user ON public.user_roles(tenant_id, user_id);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);

-- ─── Helper Functions (depend on user_roles) ────────

-- 現在のユーザーが所属するテナントID一覧
CREATE OR REPLACE FUNCTION public.get_user_tenant_ids()
RETURNS SETOF uuid
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
$$;

-- 現在のユーザーが指定テナント内で指定ロールを持つか
CREATE OR REPLACE FUNCTION public.has_role(p_tenant_id uuid, p_role text)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND tenant_id = p_tenant_id
      AND role = p_role
  )
$$;

-- ─── DD-DB-003 projects ─────────────────────────────
CREATE TABLE public.projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  status      text NOT NULL DEFAULT 'planning' CHECK (status IN ('planning','active','completed','cancelled')),
  start_date  date,
  end_date    date,
  pm_id       uuid NOT NULL REFERENCES auth.users(id),
  created_by  uuid NOT NULL REFERENCES auth.users(id),
  updated_by  uuid REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_tenant_status ON public.projects(tenant_id, status);
CREATE INDEX idx_projects_tenant_pm ON public.projects(tenant_id, pm_id);

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── DD-DB-004 project_members ──────────────────────
CREATE TABLE public.project_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);

CREATE INDEX idx_project_members_tenant_user ON public.project_members(tenant_id, user_id);

-- ─── DD-DB-005 tasks ────────────────────────────────
CREATE TABLE public.tasks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text,
  status      text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done')),
  assignee_id uuid REFERENCES auth.users(id),
  due_date    date,
  created_by  uuid NOT NULL REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_tenant_project ON public.tasks(tenant_id, project_id);
CREATE INDEX idx_tasks_tenant_assignee ON public.tasks(tenant_id, assignee_id);

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── DD-DB-006 workflows ────────────────────────────
CREATE TABLE public.workflows (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  workflow_number  text NOT NULL,
  type             text NOT NULL CHECK (type IN ('expense','leave','purchase','other')),
  title            text NOT NULL,
  description      text,
  status           text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected','withdrawn')),
  amount           numeric(12,2),
  date_from        date,
  date_to          date,
  approver_id      uuid REFERENCES auth.users(id),
  rejection_reason text,
  created_by       uuid NOT NULL REFERENCES auth.users(id),
  approved_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, workflow_number)
);

CREATE INDEX idx_workflows_tenant_status ON public.workflows(tenant_id, status);
CREATE INDEX idx_workflows_tenant_creator ON public.workflows(tenant_id, created_by);
CREATE INDEX idx_workflows_tenant_approver ON public.workflows(tenant_id, approver_id, status);

CREATE TRIGGER workflows_updated_at
  BEFORE UPDATE ON public.workflows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── DD-DB-007 timesheets ───────────────────────────
CREATE TABLE public.timesheets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id     uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  work_date   date NOT NULL,
  hours       numeric(4,2) NOT NULL CHECK (hours >= 0 AND hours <= 24),
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, project_id, task_id, work_date)
);

CREATE INDEX idx_timesheets_tenant_user_date ON public.timesheets(tenant_id, user_id, work_date);
CREATE INDEX idx_timesheets_tenant_project_date ON public.timesheets(tenant_id, project_id, work_date);

CREATE TRIGGER timesheets_updated_at
  BEFORE UPDATE ON public.timesheets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── DD-DB-008 expenses ─────────────────────────────
CREATE TABLE public.expenses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  workflow_id  uuid REFERENCES public.workflows(id) ON DELETE SET NULL,
  project_id   uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  category     text NOT NULL,
  amount       numeric(12,2) NOT NULL,
  expense_date date NOT NULL,
  description  text,
  receipt_url  text,
  created_by   uuid NOT NULL REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_expenses_tenant_creator ON public.expenses(tenant_id, created_by);
CREATE INDEX idx_expenses_tenant_project ON public.expenses(tenant_id, project_id);

CREATE TRIGGER expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── DD-DB-009 audit_logs ───────────────────────────
CREATE TABLE public.audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id),
  action        text NOT NULL,
  resource_type text NOT NULL,
  resource_id   uuid,
  before_data   jsonb,
  after_data    jsonb,
  metadata      jsonb DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_tenant_created ON public.audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_logs_tenant_resource ON public.audit_logs(tenant_id, resource_type, resource_id);
CREATE INDEX idx_audit_logs_tenant_user ON public.audit_logs(tenant_id, user_id);

-- UPDATE/DELETE 禁止トリガー
CREATE TRIGGER audit_logs_prevent_mutation
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_mutation();

-- ─── DD-DB-010 notifications ────────────────────────
CREATE TABLE public.notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type          text NOT NULL,
  title         text NOT NULL,
  body          text,
  resource_type text,
  resource_id   uuid,
  is_read       boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON public.notifications(tenant_id, user_id, is_read, created_at DESC);

-- ─── DD-DB-011 workflow_attachments ──────────────────
CREATE TABLE public.workflow_attachments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  workflow_id  uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  file_name    text NOT NULL,
  file_size    integer NOT NULL CHECK (file_size > 0 AND file_size <= 10485760),
  content_type text NOT NULL,
  storage_path text NOT NULL,
  uploaded_by  uuid NOT NULL REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflow_attachments_workflow ON public.workflow_attachments(tenant_id, workflow_id);

-- =============================================================
-- Row Level Security
-- =============================================================

-- ─── tenants ────────────────────────────────────────
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON public.tenants FOR SELECT
  USING (id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "tenant_update" ON public.tenants FOR UPDATE
  USING (public.has_role(id, 'tenant_admin'));

-- ─── user_roles ─────────────────────────────────────
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "user_roles_insert" ON public.user_roles FOR INSERT
  WITH CHECK (public.has_role(tenant_id, 'tenant_admin'));

CREATE POLICY "user_roles_delete" ON public.user_roles FOR DELETE
  USING (public.has_role(tenant_id, 'tenant_admin'));

-- ─── projects ───────────────────────────────────────
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects_select" ON public.projects FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "projects_insert" ON public.projects FOR INSERT
  WITH CHECK (
    public.has_role(tenant_id, 'pm') OR public.has_role(tenant_id, 'tenant_admin')
  );

CREATE POLICY "projects_update" ON public.projects FOR UPDATE
  USING (
    (pm_id = auth.uid() AND public.has_role(tenant_id, 'pm'))
    OR public.has_role(tenant_id, 'tenant_admin')
  );

-- ─── project_members ────────────────────────────────
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_members_select" ON public.project_members FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "project_members_insert" ON public.project_members FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT public.get_user_tenant_ids())
    AND (
      EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_id AND projects.pm_id = auth.uid())
      OR public.has_role(tenant_id, 'tenant_admin')
    )
  );

CREATE POLICY "project_members_delete" ON public.project_members FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_id AND projects.pm_id = auth.uid())
    OR public.has_role(tenant_id, 'tenant_admin')
  );

-- ─── tasks ──────────────────────────────────────────
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_select" ON public.tasks FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT public.get_user_tenant_ids())
    AND (
      EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_id AND projects.pm_id = auth.uid())
      OR public.has_role(tenant_id, 'tenant_admin')
    )
  );

CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

-- ─── workflows ──────────────────────────────────────
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workflows_select" ON public.workflows FOR SELECT
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids())
    AND (
      created_by = auth.uid()
      OR approver_id = auth.uid()
      OR public.has_role(tenant_id, 'tenant_admin')
    )
  );

CREATE POLICY "workflows_insert" ON public.workflows FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT public.get_user_tenant_ids())
    AND created_by = auth.uid()
  );

CREATE POLICY "workflows_update" ON public.workflows FOR UPDATE
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids())
    AND (
      (created_by = auth.uid() AND status IN ('draft', 'rejected'))
      OR (approver_id = auth.uid() AND status = 'submitted')
      OR public.has_role(tenant_id, 'tenant_admin')
    )
  );

-- ─── timesheets ─────────────────────────────────────
ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timesheets_select" ON public.timesheets FOR SELECT
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids())
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = timesheets.project_id
          AND projects.pm_id = auth.uid()
      )
      OR public.has_role(tenant_id, 'tenant_admin')
    )
  );

CREATE POLICY "timesheets_insert" ON public.timesheets FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND tenant_id IN (SELECT public.get_user_tenant_ids())
  );

CREATE POLICY "timesheets_update" ON public.timesheets FOR UPDATE
  USING (
    user_id = auth.uid()
    AND tenant_id IN (SELECT public.get_user_tenant_ids())
  );

CREATE POLICY "timesheets_delete" ON public.timesheets FOR DELETE
  USING (
    user_id = auth.uid()
    AND tenant_id IN (SELECT public.get_user_tenant_ids())
  );

-- ─── expenses ───────────────────────────────────────
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_select" ON public.expenses FOR SELECT
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids())
    AND (
      created_by = auth.uid()
      OR public.has_role(tenant_id, 'accounting')
      OR public.has_role(tenant_id, 'tenant_admin')
    )
  );

CREATE POLICY "expenses_insert" ON public.expenses FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT public.get_user_tenant_ids())
    AND created_by = auth.uid()
  );

CREATE POLICY "expenses_update" ON public.expenses FOR UPDATE
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids())
    AND (
      created_by = auth.uid()
      OR public.has_role(tenant_id, 'accounting')
      OR public.has_role(tenant_id, 'tenant_admin')
    )
  );

-- ─── audit_logs ─────────────────────────────────────
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_select" ON public.audit_logs FOR SELECT
  USING (
    public.has_role(tenant_id, 'it_admin')
    OR public.has_role(tenant_id, 'tenant_admin')
  );

CREATE POLICY "audit_logs_insert" ON public.audit_logs FOR INSERT
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids()));

-- ─── notifications ──────────────────────────────────
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select" ON public.notifications FOR SELECT
  USING (user_id = auth.uid() AND tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE
  USING (user_id = auth.uid() AND tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids()));

-- ─── workflow_attachments ───────────────────────────
ALTER TABLE public.workflow_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workflow_attachments_select" ON public.workflow_attachments FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "workflow_attachments_insert" ON public.workflow_attachments FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT public.get_user_tenant_ids())
    AND uploaded_by = auth.uid()
  );
