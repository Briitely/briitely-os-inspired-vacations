-- Trip history is finalized ONLY by the manual Close Travel File action.
-- Replaces the former date-driven rollup with a single transactional close operation.
-- Locks the travel file so concurrent button clicks cannot double-count.
create or replace function public.close_travel_file_with_history(p_travel_file_id uuid, p_closed_by uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_file public.travel_files%rowtype;
  v_action public.travel_actions%rowtype;
  v_contact text;
  v_value numeric;
  v_now timestamptz := now();
begin
  select * into v_file from public.travel_files where id=p_travel_file_id for update;
  if not found then raise exception 'Travel file not found'; end if;
  if v_file.file_status='closed' then return false; end if;
  if v_file.file_status<>'open' or v_file.stage<>'post_trip'
     or v_file.current_action_id is null then
    raise exception 'Travel file must be in Post-Trip / Close File';
  end if;
  select * into v_action from public.travel_actions
    where id=v_file.current_action_id and travel_file_id=v_file.id for update;
  if not found or v_action.action_code<>'post_trip_close_file'
     or v_action.status<>'active' then
    raise exception 'Post-Trip / Close File is not the active action';
  end if;
  if v_file.client_rollup_recorded_at is null then
    for v_contact, v_value in
      with members as (
        select distinct t.id member_id, nullif(btrim(p.briitely_contact_id),'') contact_id
        from public.travel_file_travellers t
        join public.traveller_profiles p on p.id=t.traveller_profile_id
        where t.travel_file_id=p_travel_file_id
      ), recipients as (
        select g.id group_id,m.contact_id
        from public.travel_payment_groups g
        join members m on m.member_id=g.payment_email_recipient_traveller_id
        where g.travel_file_id=p_travel_file_id
      ), amounts as (
        select r.contact_id,sum(coalesce(pay.amount,0)) total
        from public.travel_payments pay join recipients r on r.group_id=pay.payment_group_id
        where pay.travel_file_id=p_travel_file_id and pay.status<>'cancelled'
        group by r.contact_id
      )
      select distinct m.contact_id,coalesce(a.total,0)
      from members m left join amounts a on a.contact_id=m.contact_id
      where m.contact_id is not null order by m.contact_id
    loop
      insert into public.client_travel_profiles
        (briitely_contact_id,number_of_trips,lifetime_value,last_travel_destination,last_travel_date)
      values (v_contact,1,v_value,v_file.destination,v_file.return_date)
      on conflict (briitely_contact_id) do update set
        number_of_trips=coalesce(public.client_travel_profiles.number_of_trips,0)+1,
        lifetime_value=coalesce(public.client_travel_profiles.lifetime_value,0)+excluded.lifetime_value,
        last_travel_destination=excluded.last_travel_destination,
        last_travel_date=excluded.last_travel_date;
    end loop;
    update public.travel_files set client_rollup_recorded_at=v_now where id=p_travel_file_id;
  end if;
  update public.travel_actions set status='completed',completed_at=v_now,
    completed_by=p_closed_by,completion_source='portal',completion_event='travel_file_closed'
    where id=v_action.id;
  update public.travel_files set file_status='closed',stage='travel_complete',
    stage_changed_at=v_now,current_action_id=null,closed_at=v_now where id=p_travel_file_id;
  insert into public.travel_activity
    (travel_file_id,event_type,summary,actor_type,actor_user_id,action_id,previous_stage,new_stage,metadata)
  values (p_travel_file_id,'travel_file_closed',
    'Post-trip follow-up completed. Travel File closed and moved to Past Trips.',
    'internal',p_closed_by,v_action.id,v_file.stage,'travel_complete',
    jsonb_build_object('trip_history_recorded',true));
  return true;
end;
$$;
revoke all on function public.close_travel_file_with_history(uuid,uuid) from public,anon,authenticated;
grant execute on function public.close_travel_file_with_history(uuid,uuid) to service_role;
-- Remove execute access to the old cron rollup entry point.
revoke all on function public.record_travel_file_trip_history(uuid) from service_role;
