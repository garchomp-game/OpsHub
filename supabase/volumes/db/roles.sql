-- Supabase Roles init
-- Custom types
CREATE TYPE auth.aal_level AS ENUM ('aal1', 'aal2', 'aal3');
CREATE TYPE auth.code_challenge_method AS ENUM ('s256', 'plain');
CREATE TYPE auth.factor_status AS ENUM ('unverified', 'verified');
CREATE TYPE auth.factor_type AS ENUM ('totp', 'webauthn');

-- PostgreSQL Roles for Supabase

-- anon role
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
END
$$;

-- authenticated role
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
END
$$;

-- service_role
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
END
$$;

-- supabase_auth_admin
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE USER supabase_auth_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;
  END IF;
END
$$;

GRANT ALL PRIVILEGES ON DATABASE postgres TO supabase_auth_admin;

-- supabase_storage_admin
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    CREATE USER supabase_storage_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;
  END IF;
END
$$;

GRANT ALL PRIVILEGES ON DATABASE postgres TO supabase_storage_admin;

-- supabase_admin
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'supabase_admin') THEN
    CREATE USER supabase_admin NOINHERIT CREATEROLE LOGIN REPLICATION BYPASSRLS;
  END IF;
END
$$;

GRANT ALL PRIVILEGES ON DATABASE postgres TO supabase_admin;

-- authenticator
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticator') THEN
    CREATE USER authenticator NOINHERIT LOGIN;
  END IF;
END
$$;

GRANT anon TO authenticator;
GRANT authenticated TO authenticator;
GRANT service_role TO authenticator;
GRANT supabase_admin TO authenticator;

-- Grants
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;

-- Create auth schema
CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION supabase_auth_admin;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;

-- Create storage schema
CREATE SCHEMA IF NOT EXISTS storage AUTHORIZATION supabase_storage_admin;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
GRANT ALL ON SCHEMA storage TO supabase_storage_admin;

-- Create extensions schema
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgjwt WITH SCHEMA extensions;

-- Set role passwords
ALTER USER supabase_auth_admin WITH PASSWORD :'POSTGRES_PASSWORD';
ALTER USER supabase_storage_admin WITH PASSWORD :'POSTGRES_PASSWORD';
ALTER USER supabase_admin WITH PASSWORD :'POSTGRES_PASSWORD';
ALTER USER authenticator WITH PASSWORD :'POSTGRES_PASSWORD';
