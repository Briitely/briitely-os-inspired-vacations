/*
# Fix SECURITY DEFINER Function Execute Grants

1. Purpose
   PostgreSQL functions default to EXECUTE granted to PUBLIC (all roles).
   The prior REVOKE FROM anon was insufficient because PUBLIC still
   includes anon. This migration:
   - Revokes EXECUTE FROM PUBLIC on all SECURITY DEFINER functions
   - Re-grants EXECUTE only to authenticated on the functions that
     should be callable by signed-in users (is_admin, is_super_admin,
     admin_update_profile)
   - Leaves handle_new_user with no execute grants (trigger-only)

2. Important Notes
   - Idempotent: REVOKE and GRANT are safe to re-run.
   - No data is modified or deleted.
*/

-- Revoke EXECUTE from PUBLIC on all SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.admin_update_profile(uuid, text, text, text, text, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;

-- Grant EXECUTE only to authenticated on user-callable functions
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_profile(uuid, text, text, text, text, boolean) TO authenticated;

-- handle_new_user: no grants — trigger-only
