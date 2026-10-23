-- Restrict the 13 existing authenticated policies to active Inspired Vacations portal staff.
-- Preserve the original policy names, roles, commands, and applicable USING/WITH CHECK clauses.
-- No changes to public booking links or service-role operations.
-- Apply only after reviewing current production policies against the audited snapshot.
BEGIN;

DO $check$
BEGIN
  IF to_regprocedure('public.is_active_portal_user()') IS NULL THEN
    RAISE EXCEPTION 'Required public.is_active_portal_user() function is missing';
  END IF;
END;
$check$;

ALTER POLICY "authenticated staff can manage booking form sessions" ON public."booking_form_sessions" TO authenticated USING (SELECT public.is_active_portal_user()) WITH CHECK (SELECT public.is_active_portal_user());
ALTER POLICY "authenticated staff can manage client relationships" ON public."client_relationships" TO authenticated USING (SELECT public.is_active_portal_user()) WITH CHECK (SELECT public.is_active_portal_user());
ALTER POLICY "authenticated staff can manage client travel profiles" ON public."client_travel_profiles" TO authenticated USING (SELECT public.is_active_portal_user()) WITH CHECK (SELECT public.is_active_portal_user());
ALTER POLICY "delete_invoice_commissions" ON public."invoice_commissions" TO authenticated USING (SELECT public.is_active_portal_user());
ALTER POLICY "insert_invoice_commissions" ON public."invoice_commissions" TO authenticated WITH CHECK (SELECT public.is_active_portal_user());
ALTER POLICY "select_invoice_commissions" ON public."invoice_commissions" TO authenticated USING (SELECT public.is_active_portal_user());
ALTER POLICY "update_invoice_commissions" ON public."invoice_commissions" TO authenticated USING (SELECT public.is_active_portal_user()) WITH CHECK (SELECT public.is_active_portal_user());
ALTER POLICY "authenticated users can create travel file tasks" ON public."travel_file_tasks" TO authenticated WITH CHECK (SELECT public.is_active_portal_user());
ALTER POLICY "authenticated users can delete travel file tasks" ON public."travel_file_tasks" TO authenticated USING (SELECT public.is_active_portal_user());
ALTER POLICY "authenticated users can update travel file tasks" ON public."travel_file_tasks" TO authenticated USING (SELECT public.is_active_portal_user()) WITH CHECK (SELECT public.is_active_portal_user());
ALTER POLICY "authenticated users can view travel file tasks" ON public."travel_file_tasks" TO authenticated USING (SELECT public.is_active_portal_user());
ALTER POLICY "authenticated staff can manage travel file travellers" ON public."travel_file_travellers" TO authenticated USING (SELECT public.is_active_portal_user()) WITH CHECK (SELECT public.is_active_portal_user());
ALTER POLICY "authenticated staff can manage traveller profiles" ON public."traveller_profiles" TO authenticated USING (SELECT public.is_active_portal_user()) WITH CHECK (SELECT public.is_active_portal_user());

COMMIT;
