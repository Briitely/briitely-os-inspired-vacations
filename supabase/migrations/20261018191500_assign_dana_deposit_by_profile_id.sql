-- Resolve Process Deposit to Dana Pasquotti's existing active profile ID.
-- Avoid name-based lookup and preserve the next-business-day deadline.
create or replace function public.iv_proposal_action_deadlines()
returns trigger language plpgsql security definer set search_path=public as $$
declare
 advisor uuid;
 dana_id constant uuid := '57c99ca4-6128-4920-9d69-744f85cc514b';
 dana_active boolean;
begin
 if new.status <> 'active' then return new; end if;
 if new.action_code = 'proposal_acceptance_deposit_agreement' then
   select assigned_advisor_id into advisor from public.travel_files where id = new.travel_file_id;
   new.responsible_type := 'internal';
   new.responsible_user_id := advisor;
   new.due_at := public.iv_next_business_day(coalesce(new.activated_at,now()));
   new.waiting_since := null;
 elsif new.action_code = 'await_proposal_acceptance' then
   new.responsible_type := 'client';
   new.responsible_user_id := null;
   new.due_at := null;
   new.waiting_since := coalesce(new.waiting_since,now());
 elsif new.action_code = 'collect_deposit' then
   select is_active into dana_active from public.profiles where id = dana_id;
   if dana_active is distinct from true then
     raise exception 'Process Deposit assignee profile is missing or inactive';
   end if;
   new.responsible_type := 'internal';
   new.responsible_user_id := dana_id;
   new.due_at := public.iv_next_business_day(coalesce(new.activated_at,now()));
   new.waiting_since := null;
 end if;
 return new;
end;
$$;
