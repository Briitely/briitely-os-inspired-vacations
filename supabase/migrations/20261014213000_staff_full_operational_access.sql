-- Staff should have full operational access across Inspired Vacations.
-- Admin-only UI remains limited to the Admin module and workflow Override.

CREATE OR REPLACE FUNCTION public.is_active_portal_user()
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
      and role in ('staff', 'admin', 'super_admin')
      and is_active = true
  );
$function$;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Active users can view profiles" ON public.profiles;

CREATE POLICY "Active users can view profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_active_portal_user());

DROP POLICY IF EXISTS "travel_files_delete_active_staff" ON public.travel_files;
CREATE POLICY "travel_files_delete_active_staff"
  ON public.travel_files FOR DELETE
  TO authenticated
  USING (public.is_active_portal_user());

DROP POLICY IF EXISTS "travel_notes_delete_active_staff" ON public.travel_notes;
CREATE POLICY "travel_notes_delete_active_staff"
  ON public.travel_notes FOR DELETE
  TO authenticated
  USING (public.is_active_portal_user());
