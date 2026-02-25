-- ============================================================
-- 全文検索インデックス（ADR-0006: pg_trgm + GIN）
-- ============================================================

-- pg_trgm 拡張の有効化
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- workflows: title, description の部分一致検索用
CREATE INDEX idx_workflows_search
  ON workflows USING GIN (title gin_trgm_ops, description gin_trgm_ops);

-- projects: name, description の部分一致検索用
CREATE INDEX idx_projects_search
  ON projects USING GIN (name gin_trgm_ops, description gin_trgm_ops);

-- tasks: title の部分一致検索用
CREATE INDEX idx_tasks_search
  ON tasks USING GIN (title gin_trgm_ops);

-- expenses: description の部分一致検索用
CREATE INDEX idx_expenses_search
  ON expenses USING GIN (description gin_trgm_ops);

-- documents: name の部分一致検索用
CREATE INDEX idx_documents_search
  ON documents USING GIN (name gin_trgm_ops);
