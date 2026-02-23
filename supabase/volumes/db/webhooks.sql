-- Supabase Webhooks init

BEGIN;
  -- Create pg_net extension
  CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

  -- Create supabase_functions schema
  CREATE SCHEMA IF NOT EXISTS supabase_functions;
  GRANT USAGE ON SCHEMA supabase_functions TO postgres, anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA supabase_functions GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA supabase_functions GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA supabase_functions GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;

  -- supabase_functions.migrations
  CREATE TABLE supabase_functions.migrations (
    version text PRIMARY KEY,
    inserted_at timestamptz NOT NULL DEFAULT NOW()
  );

  -- supabase_functions.hooks
  CREATE TABLE supabase_functions.hooks (
    id bigserial PRIMARY KEY,
    hook_table_id integer NOT NULL DEFAULT 0,
    hook_name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    request_id bigint
  );

  CREATE INDEX supabase_functions_hooks_request_id_idx ON supabase_functions.hooks USING btree (request_id);
  CREATE INDEX supabase_functions_hooks_h_table_id_h_name_idx ON supabase_functions.hooks USING btree (hook_table_id, hook_name);

  -- Grant access
  GRANT ALL PRIVILEGES ON SCHEMA supabase_functions TO supabase_admin;
  GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA supabase_functions TO supabase_admin;
  GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA supabase_functions TO supabase_admin;

  ALTER ROLE supabase_admin SET search_path = "\\$user", public, extensions, supabase_functions;
COMMIT;
