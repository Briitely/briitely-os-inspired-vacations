-- Profiles can store names in first_name/last_name while full_name is null.
-- Match Dana using the same profile columns used throughout the dashboard.
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
   where is_active=true
     and (
       lower(regexp_replace(trim(coalesce(full_name,'')),'[[:space:]]+',' ','g'))='dana pasquati'
       or (
         lower(trim(coalesce(first_name,'')))='dana'
         and lower(trim(coalesce(last_name,'')))='pasquati'
       )
     );
   if dana_count<>1 then
     raise exception 'Cannot uniquely assign Process Deposit to Dana Pasquati: % active matching profiles',dana_count;
   end if;
   new.responsible_type:='internal';
   new.responsible_user_id:=dana_id;
   new.due_at:=public.iv_next_business_day(coalesce(new.activated_at,now()));
   new.waiting_since:=null;
 end if;
 return new;
end;
$$;
