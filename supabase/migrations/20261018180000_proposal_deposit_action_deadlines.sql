-- Set next-business-day deadlines for proposal preparation and deposit processing.
-- Business days are Monday-Friday in the agency's Alberta timezone; statutory holidays
-- are not excluded. Client waiting starts when the proposal email is sent.
create or replace function public.iv_next_business_day(p_at timestamptz)
returns timestamptz language plpgsql stable as $$
declare
 local_date date := (p_at at time zone 'America/Edmonton')::date + 1;
begin
 while extract(isodow from local_date) in (6,7) loop
   local_date:=local_date+1;
 end loop;
 return (local_date::timestamp + time '17:00') at time zone 'America/Edmonton';
end;
$$;

create or replace function public.iv_proposal_action_deadlines()
returns trigger language plpgsql security definer set search_path=public as $$
declare
 advisor uuid;
 dana_id uuid;
 dana_count integer;
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
   select count(*),min(id) into dana_count,dana_id
   from public.profiles
   where is_active=true and (full_name ilike 'Dana %' or full_name ilike 'Dana');
   if dana_count<>1 then
     raise exception 'Cannot assign Process Deposit: expected one active Dana profile, found %',dana_count;
   end if;
   new.responsible_type:='internal';
   new.responsible_user_id:=dana_id;
   new.due_at:=public.iv_next_business_day(coalesce(new.activated_at,now()));
   new.waiting_since:=null;
 end if;
 return new;
end;
$$;
drop trigger if exists iv_proposal_action_deadlines_insert on public.travel_actions;
create trigger iv_proposal_action_deadlines_insert
before insert on public.travel_actions
for each row when (new.action_code in ('proposal_acceptance_deposit_agreement','await_proposal_acceptance','collect_deposit'))
execute function public.iv_proposal_action_deadlines();
