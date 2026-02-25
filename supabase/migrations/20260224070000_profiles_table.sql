-- =============================================================
-- Profiles Table Migration
-- public.profiles: auth.users の表示名を保持し、RLS 経由で安全に参照可能にする
-- =============================================================

-- ─── profiles テーブル ──────────────────────────────
CREATE TABLE public.profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  avatar_url   text,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── RLS ────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 同一テナント内のユーザーなら誰でも閲覧可能
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
  USING (
    id IN (
      SELECT ur.user_id FROM public.user_roles ur
      WHERE ur.tenant_id IN (SELECT public.get_user_tenant_ids())
    )
    OR id = auth.uid()
  );

-- 本人のみ更新可能
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- INSERT は トリガー関数（SECURITY DEFINER）経由のみ
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT
  WITH CHECK (true);

-- ─── auth.users INSERT 時に profiles を自動作成するトリガー関数 ──
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.email,
      'Unknown'
    )
  )
  ON CONFLICT (id) DO UPDATE
    SET display_name = EXCLUDED.display_name;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- auth.users UPDATE 時にも display_name を同期する
CREATE OR REPLACE FUNCTION public.handle_user_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- raw_user_meta_data->>'name' が変更された場合のみ同期
  IF NEW.raw_user_meta_data->>'name' IS DISTINCT FROM OLD.raw_user_meta_data->>'name' THEN
    UPDATE public.profiles
    SET display_name = COALESCE(NEW.raw_user_meta_data->>'name', NEW.email, 'Unknown')
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_updated();

-- ─── 既存ユーザーのバックフィル ────────────────────
INSERT INTO public.profiles (id, display_name)
SELECT
  id,
  COALESCE(raw_user_meta_data->>'name', email, 'Unknown')
FROM auth.users
ON CONFLICT (id) DO NOTHING;
