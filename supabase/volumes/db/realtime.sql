-- Supabase Realtime init

\set pguser `echo "$POSTGRES_USER"`

CREATE PUBLICATION supabase_realtime FOR ALL TABLES;

-- Extension for Realtime RLS
BEGIN;
  -- Create supabase_realtime_admin user
  CREATE USER supabase_realtime_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;
  GRANT ALL PRIVILEGES ON DATABASE postgres TO supabase_realtime_admin;
  GRANT ALL PRIVILEGES ON SCHEMA public TO supabase_realtime_admin;
  GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO supabase_realtime_admin;
  GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO supabase_realtime_admin;
  ALTER USER supabase_realtime_admin SET search_path = 'public';

  -- Create _realtime schema
  CREATE SCHEMA IF NOT EXISTS _realtime;
  GRANT ALL PRIVILEGES ON SCHEMA _realtime TO supabase_realtime_admin;
  GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA _realtime TO supabase_realtime_admin;
  GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA _realtime TO supabase_realtime_admin;
COMMIT;
