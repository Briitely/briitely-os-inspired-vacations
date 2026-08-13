/*
# Fix Security Advisor Warnings

1. Purpose
   Addresses all 9 security advisor warnings from the initial Core migration:
   - Mutable search_path on update_updated_at_column
   - SECURITY DEFINER functions callable by anon role
   - handle_new_user callable via RPC by authenticated role (should be trigger-only)

2. Changes
   a. update_updated_at_column: add SET search_path = public
   b. Revoke EXECUTE from anon on all SECURITY DEFINER functions
   c. Revoke EXECUTE from authenticated on handle_new_user (trigger-only)
   d. Keep EXECUTE on authenticated for is_admin, is_super_admin,
      and admin_update_profile (intentionally callable by signed-in users)

3. Security
   - anon role can no longer call any SECURITY DEFINER function via the
     REST API (/rest/v1/rpc/...).
   - handle_new_user is now trigger-only — not callable via RPC by any role.
   - is_admin, is_super_admin, admin_update_profile remain callable by
     authenticated users (they contain their own authorization checks).

4. Important Notes
   - Idempotent: uses CREATE OR REPLACE and DROP/REVOKE IF EXISTS patterns.
   - No data is modified or deleted.
*/

-- =========================================================
-- 1. Fix update_updated_at_column: add SET search_path
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
-- 2. Revoke EXECUTE from anon on all SECURITY DEFINER functions
--    Revoke EXECUTE from authenticated on handle_new_user (trigger-only)
-- =========================================================
REVOKE EXECUTE ON FUNCTION public.admin_update_profile(uuid, text, text, text, text, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

-- =========================================================
-- 3. Re-grant EXECUTE to authenticated on the functions that
--    should remain callable by signed-in users
-- =========================================================
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_profile(uuid, text, text, text, text, boolean) TO authenticated;
