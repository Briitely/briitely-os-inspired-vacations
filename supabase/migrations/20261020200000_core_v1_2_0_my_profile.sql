/* Core v1.2.0 — My Profile

Team members can now edit their own name and phone number from My Profile
(/account). Those changes go through the /api/account/profile route, which
only ever writes first_name, last_name, full_name and phone.

Security fix: the original "Users can update own profile" policy let any
signed-in user update every column of their own row straight from the
browser, including role, is_active and ghl_user_id, so a Staff user could
make themselves Super Admin. Nothing in the app relied on it (admin edits use
admin_update_profile and server routes use service access), so it is removed.
*/

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
