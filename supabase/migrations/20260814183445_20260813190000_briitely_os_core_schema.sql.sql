/*
# Briitely OS Core — Consolidated Schema Migration

1. Purpose
   This is the single, clean, consolidated migration for the Briitely OS Core
   workspace. It replaces the seven inherited SAF-specific migrations with one
   idempotent migration that builds the entire Core schema from scratch on a
   fresh Supabase database.

2. New Tables
   - `profiles`
     - `id` uuid, primary key, references auth.users(id) ON DELETE CASCADE
     - `email` text, nullable
     - `full_name` text, nullable
     - `first_name` text, nullable
     - `last_name` text, nullable
     - `role` app_role, not null, default 'staff'
     - `is_active` boolean, not null, default true
     - `ghl_user_id` text, nullable — links to HighLevel user
     - `created_at` timestamptz, default now()
     - `updated_at` timestamptz, default now()
   - `client_settings`
     - `id` uuid, primary key, default gen_random_uuid()
     - `setting_key` text, unique, not null
     - `setting_value` jsonb, not null, default '{}'
     - `description` text, nullable
     - `updated_at` timestamptz, default now()
   - `activity_log`
     - `id` uuid, primary key, default gen_random_uuid()
     - `user_id` uuid, nullable, references auth.users(id) ON DELETE SET NULL
     - `action` text, not null
     - `entity_type` text, nullable
     - `external_id` text, nullable
     - `metadata` jsonb, not null, default '{}'
     - `created_at` timestamptz, default now()
   - `integration_log`
     - `id` uuid, primary key, default gen_random_uuid()
     - `provider` text, not null
     - `operation` text, not null
     - `entity_type` text, nullable
     - `external_id` text, nullable
     - `status` text, not null
     - `error_code` text, nullable
     - `error_message` text, nullable
     - `metadata` jsonb, not null, default '{}'
     - `created_at` timestamptz, default now()
     - `completed_at` timestamptz, nullable
   - `invoice_commissions`
     - `id` uuid, primary key, default gen_random_uuid()
     - `invoice_id` text, not null, unique
     - `invoice_number` text, nullable
     - `contact_id` text, not null
     - `customer_name` text, nullable
     - `assigned_user_id` text, nullable
     - `commission_sale` boolean, not null, default false
     - `commission_paid` boolean, not null, default false
     - `commission_paid_at` timestamptz, nullable
     - `commission_paid_by` text, nullable
     - `created_at` timestamptz, default now()
     - `updated_at` timestamptz, default now()

3. New Types
   - `app_role` enum: ('super_admin', 'admin', 'staff')

4. Functions
   - `update_updated_at_column()` — shared trigger function for updated_at
   - `handle_new_user()` — SECURITY DEFINER trigger that auto-creates a profile
     row when a new auth user is created
   - `is_admin()` — SECURITY DEFINER, returns true for active admin/super_admin
   - `is_super_admin()` — SECURITY DEFINER, returns true for active super_admin
   - `admin_update_profile()` — SECURITY DEFINER, allows admins to update
     user profiles with role-cast fix and all safeguards

5. Triggers
   - `on_auth_user_created` on auth.users AFTER INSERT -> handle_new_user()
   - `trg_profiles_updated_at` on profiles BEFORE UPDATE -> update_updated_at_column()
   - `trg_client_settings_updated_at` on client_settings BEFORE UPDATE -> update_updated_at_column()
   - `trg_invoice_commissions_updated_at` on invoice_commissions BEFORE UPDATE -> update_updated_at_column()

6. Security (RLS)
   - `profiles`: RLS enabled
     - SELECT: users can read own profile; admins can read all
     - UPDATE: users can update own profile
   - `client_settings`: RLS enabled
     - Admin-only CRUD (SELECT, INSERT, UPDATE, DELETE) via is_admin()
   - `activity_log`: RLS enabled
     - SELECT: users can read own activity (auth.uid() = user_id)
     - INSERT: users can insert own activity (WITH CHECK auth.uid() = user_id)
   - `integration_log`: RLS enabled
     - SELECT: admin-only via is_admin()
     - No INSERT/UPDATE/DELETE policies — service role only (bypasses RLS)
   - `invoice_commissions`: RLS enabled
     - All CRUD for authenticated users

7. Seeded Defaults
   - `business`: "Your Business", empty address, Canada country
   - `regional`: America/Toronto timezone, CAD currency, en-CA locale
   - `invoice`: empty payment instructions and terms
   - `branding`: neutral slate/sky palette, no logo

8. Important Notes
   - This migration is fully idempotent and safe to re-run.
   - No existing data is modified or deleted.
*/

-- =========================================================
-- 1. app_role enum
-- =========================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'app_role'
  ) THEN
    CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'staff');
  END IF;
END $$;

-- =========================================================
-- 2. profiles table
-- =========================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  first_name text,
  last_name text,
  role public.app_role NOT NULL DEFAULT 'staff',
  is_active boolean NOT NULL DEFAULT true,
  ghl_user_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- 3. client_settings table
-- =========================================================
CREATE TABLE IF NOT EXISTS public.client_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- 4. activity_log table
-- =========================================================
CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  external_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_user_id
  ON public.activity_log (user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at
  ON public.activity_log (created_at DESC);

-- =========================================================
-- 5. integration_log table
-- =========================================================
CREATE TABLE IF NOT EXISTS public.integration_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  operation text NOT NULL,
  entity_type text,
  external_id text,
  status text NOT NULL,
  error_code text,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_integration_log_provider
  ON public.integration_log (provider);
CREATE INDEX IF NOT EXISTS idx_integration_log_created_at
  ON public.integration_log (created_at DESC);

-- =========================================================
-- 6. invoice_commissions table
-- =========================================================
CREATE TABLE IF NOT EXISTS public.invoice_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id text NOT NULL UNIQUE,
  invoice_number text,
  contact_id text NOT NULL,
  customer_name text,
  assigned_user_id text,
  commission_sale boolean NOT NULL DEFAULT false,
  commission_paid boolean NOT NULL DEFAULT false,
  commission_paid_at timestamptz,
  commission_paid_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_commissions_contact_id
  ON public.invoice_commissions (contact_id);

-- =========================================================
-- 7. Shared trigger function: update_updated_at_column
-- =========================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================================================
-- 8. handle_new_user — auto-create profile on auth signup
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, first_name, last_name, role, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    TRIM(COALESCE(NEW.raw_user_meta_data->>'first_name', '') || ' ' || COALESCE(NEW.raw_user_meta_data->>'last_name', '')),
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    'staff'::public.app_role,
    true
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- =========================================================
-- 9. Triggers
-- =========================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_client_settings_updated_at ON public.client_settings;
CREATE TRIGGER trg_client_settings_updated_at
  BEFORE UPDATE ON public.client_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_invoice_commissions_updated_at ON public.invoice_commissions;
CREATE TRIGGER trg_invoice_commissions_updated_at
  BEFORE UPDATE ON public.invoice_commissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 10. Admin helper functions
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role in ('admin', 'super_admin')
      and is_active = true
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'super_admin'
      and is_active = true
  );
$function$;

-- =========================================================
-- 11. Enable RLS on all tables
-- =========================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_commissions ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 12. RLS Policies
-- =========================================================

-- ---- profiles ----
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ---- client_settings ----
DROP POLICY IF EXISTS "Admins can read client settings" ON public.client_settings;
CREATE POLICY "Admins can read client settings"
  ON public.client_settings FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert client settings" ON public.client_settings;
CREATE POLICY "Admins can insert client settings"
  ON public.client_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update client settings" ON public.client_settings;
CREATE POLICY "Admins can update client settings"
  ON public.client_settings FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete client settings" ON public.client_settings;
CREATE POLICY "Admins can delete client settings"
  ON public.client_settings FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ---- activity_log ----
DROP POLICY IF EXISTS "Users can read own activity" ON public.activity_log;
CREATE POLICY "Users can read own activity"
  ON public.activity_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own activity" ON public.activity_log;
CREATE POLICY "Users can insert own activity"
  ON public.activity_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ---- integration_log ----
DROP POLICY IF EXISTS "Admins can read integration log" ON public.integration_log;
CREATE POLICY "Admins can read integration log"
  ON public.integration_log FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ---- invoice_commissions ----
DROP POLICY IF EXISTS "select_invoice_commissions" ON public.invoice_commissions;
CREATE POLICY "select_invoice_commissions"
  ON public.invoice_commissions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "insert_invoice_commissions" ON public.invoice_commissions;
CREATE POLICY "insert_invoice_commissions"
  ON public.invoice_commissions FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "update_invoice_commissions" ON public.invoice_commissions;
CREATE POLICY "update_invoice_commissions"
  ON public.invoice_commissions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "delete_invoice_commissions" ON public.invoice_commissions;
CREATE POLICY "delete_invoice_commissions"
  ON public.invoice_commissions FOR DELETE
  TO authenticated
  USING (true);

-- =========================================================
-- 13. admin_update_profile function
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_update_profile(
  p_target_user_id uuid,
  p_first_name text DEFAULT NULL,
  p_last_name text DEFAULT NULL,
  p_role text DEFAULT NULL,
  p_ghl_user_id text DEFAULT NULL,
  p_is_active boolean DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_is_admin boolean;
  v_caller_is_super_admin boolean;
  v_target_role text;
  v_target_is_active boolean;
  v_new_role text;
  v_new_is_active boolean;
  v_active_super_admin_count integer;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN json_build_object('error', 'You must be signed in to perform this action.');
  END IF;

  v_caller_is_admin := public.is_admin();
  v_caller_is_super_admin := public.is_super_admin();

  IF NOT v_caller_is_admin THEN
    RETURN json_build_object('error', 'You do not have permission to perform this action.');
  END IF;

  SELECT role::text, is_active INTO v_target_role, v_target_is_active
  FROM public.profiles
  WHERE id = p_target_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'User not found.');
  END IF;

  IF v_target_role = 'super_admin' AND NOT v_caller_is_super_admin THEN
    RETURN json_build_object('error', 'You cannot modify a Super Admin account.');
  END IF;

  v_new_role := COALESCE(p_role, v_target_role);

  IF v_new_role NOT IN ('super_admin', 'admin', 'staff') THEN
    RETURN json_build_object('error', 'Invalid role specified.');
  END IF;

  IF v_new_role = 'super_admin' AND NOT v_caller_is_super_admin THEN
    RETURN json_build_object('error', 'Only a Super Admin can assign the Super Admin role.');
  END IF;

  IF p_is_active = false AND p_target_user_id = v_caller_id THEN
    RETURN json_build_object('error', 'You cannot deactivate your own account.');
  END IF;

  v_new_is_active := COALESCE(p_is_active, v_target_is_active);

  IF v_target_role = 'super_admin' AND v_target_is_active = true
     AND (v_new_role <> 'super_admin' OR v_new_is_active = false) THEN
    SELECT count(*) INTO v_active_super_admin_count
    FROM public.profiles
    WHERE role = 'super_admin'
      AND is_active = true
      AND id <> p_target_user_id;

    IF v_active_super_admin_count = 0 THEN
      RETURN json_build_object('error', 'You cannot remove or demote the last active Super Admin. Please promote another user first.');
    END IF;
  END IF;

  UPDATE public.profiles
  SET
    first_name = COALESCE(p_first_name, first_name),
    last_name = COALESCE(p_last_name, last_name),
    full_name = CASE
      WHEN p_first_name IS NOT NULL OR p_last_name IS NOT NULL THEN
        TRIM(COALESCE(p_first_name, first_name) || ' ' || COALESCE(p_last_name, last_name))
      ELSE full_name
    END,
    role = v_new_role::public.app_role,
    ghl_user_id = CASE
      WHEN p_ghl_user_id IS NOT NULL THEN NULLIF(p_ghl_user_id, '')
      ELSE ghl_user_id
    END,
    is_active = v_new_is_active,
    updated_at = now()
  WHERE id = p_target_user_id;

  RETURN json_build_object('success', true);
END;
$$;

-- =========================================================
-- 14. Grants (revoke from PUBLIC first, then grant to authenticated)
-- =========================================================
REVOKE EXECUTE ON FUNCTION public.admin_update_profile(uuid, text, text, text, text, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_profile(uuid, text, text, text, text, boolean) TO authenticated;

-- =========================================================
-- 15. Seed bootstrap defaults into client_settings
-- =========================================================
INSERT INTO public.client_settings (setting_key, setting_value, description)
VALUES
  ('business', '{
    "businessName": "Your Business",
    "logoUrl": "",
    "phone": "",
    "website": "",
    "email": "",
    "address": {
      "street": "",
      "city": "",
      "province": "",
      "postalCode": "",
      "country": "Canada"
    }
  }'::jsonb, 'Business identity and address')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO public.client_settings (setting_key, setting_value, description)
VALUES
  ('regional', '{
    "timezone": "America/Toronto",
    "currency": "CAD",
    "locale": "en-CA"
  }'::jsonb, 'Regional settings: timezone, currency, locale')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO public.client_settings (setting_key, setting_value, description)
VALUES
  ('invoice', '{
    "paymentInstructions": "",
    "latePaymentTerms": "",
    "defaultSenderUserId": "",
    "defaultSenderEmail": ""
  }'::jsonb, 'Invoice and payment settings')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO public.client_settings (setting_key, setting_value, description)
VALUES
  ('branding', '{
    "logoUrl": "",
    "primaryColor": "#334155",
    "secondaryColor": "#64748b",
    "accentColor": "#0ea5e9"
  }'::jsonb, 'Business branding: logo URL and brand colors')
ON CONFLICT (setting_key) DO NOTHING;