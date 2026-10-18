-- Replace fragile partial-name matching with the established exact team profile.
-- Preserve the next-business-day deadline and avoid misassigning deposit work.
create or replace function public.iv_proposal_action_deadlines()
returns trigger language plpgsql security definer set search_path=public as $$
declare
 advisor uuid;
 dana_id uuid;
begin
 if new.status<>'active' then return new; end if;
 if new.action_code='proposal_acceptance_deposit_agreement' then
   select assigned_advisor_id into advisor from public.travel_files where id=new.travel_file_id;
   new.responsible_type:='internal';
   new.responsible_user_id:=advisor;
   new.due_at:=public.iv_next_business_day(coalesce(new.activated_at,now()));
   new.waiting_since:=null;
 elsif new.action_code='await_proposal_acceptance' then
   new.responsible_type:='client';
   new.responsible_user_id:=null;
   new.due_at:=null;
   new.waiting_since:=coalesce(new.waiting_since,now());
 elsif new.action_code='collect_deposit' then
   select id into dana_id from public.profiles
   where is_active=true and trim(full_name) ilike 'Dana Pasquati'
   limit 1;
   if dana_id is null then
     raise exception 'Cannot assign Process Deposit: Dana Pasquati is not an active team profile';
   end if;
   new.responsible_type:='internal';
   new.responsible_user_id:=dana_id;
   new.due_at:=public.iv_next_business_day(coalesce(new.activated_at,now()));
   new.waiting_since:=null;
 end if;
 return new;
end;
$$;
