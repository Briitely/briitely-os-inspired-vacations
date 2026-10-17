-- Atomic file split, stage one: create linked files and preserve group memberships.
-- Callable only by service_role; not yet connected to the Finalize button.
create or replace function public.create_negotiated_group_files(p_source_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  src public.travel_files%rowtype;
  original_primary uuid;
  grp record;
  member record;
  profile record;
  new_file uuid;
  new_primary uuid;
  created uuid[] := array[]::uuid[];
  decided_count int;
  group_count int;
  member_count int;
  signed_id uuid;
  payment_id uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  select * into src from public.travel_files where id=p_source_id for update;
  if not found then raise exception 'Source file not found'; end if;
  if not exists (select 1 from public.travel_actions where id=src.current_action_id
    and action_code='negotiate_proposal' and status='active')
  then raise exception 'Negotiation is not active'; end if;
  if exists(select 1 from public.travel_file_group_splits where source_travel_file_id=p_source_id)
  then raise exception 'Already split'; end if;
  select id into original_primary from public.travel_file_travellers
    where travel_file_id=p_source_id and traveller_role='primary';
  if original_primary is null then raise exception 'Original primary missing'; end if;
  select count(*) into group_count from public.travel_group_retainers where travel_file_id=p_source_id;
  select count(*) into decided_count from public.travel_group_retainers r
    join public.travel_group_negotiations n on n.travel_file_id=r.travel_file_id
      and n.recipient_party_member_id=r.recipient_party_member_id
    where r.travel_file_id=p_source_id and n.decision in ('accepted','declined');
  if group_count=0 or group_count<>decided_count then raise exception 'Outstanding group decisions'; end if;
  if not exists(select 1 from public.travel_group_negotiations where travel_file_id=p_source_id
    and recipient_party_member_id=original_primary and decision='accepted')
  then raise exception 'Original primary group must be accepted'; end if;
  for grp in select * from public.travel_group_negotiations
    where travel_file_id=p_source_id and decision='accepted'
      and recipient_party_member_id<>original_primary
  loop
    select p.* into profile from public.traveller_profiles p
      join public.travel_file_travellers t on t.traveller_profile_id=p.id
      where t.id=grp.recipient_party_member_id and t.travel_file_id=p_source_id;
    if not found then raise exception 'Missing recipient traveller'; end if;
    select id into signed_id from public.travel_group_retainer_acceptances
      where travel_file_id=p_source_id and recipient_party_member_id=grp.recipient_party_member_id
      order by accepted_at desc limit 1;
    select l.payment_id into payment_id from public.travel_group_retainer_payments l
      join public.travel_payments p on p.id=l.payment_id and p.travel_file_id=p_source_id
      where l.travel_file_id=p_source_id and l.recipient_party_member_id=grp.recipient_party_member_id;
    if signed_id is null or payment_id is null then raise exception 'Missing signed retainer or payment'; end if;
    -- Copy common trip metadata, but never copy the source workflow or reservation identifiers.
    insert into public.travel_files
      (client_name,briitely_contact_id,assigned_advisor_id,destination,trip_type,
       travel_timeframe,departure_date,return_date,budget_range,insurance_interest,
       special_requests,travel_interests,travel_seasons,inquiry_source,intake_method,
       stage,stage_changed_at)
    values
      (concat_ws(' ',profile.first_name,profile.last_name),profile.briitely_contact_id,
       src.assigned_advisor_id,src.destination,src.trip_type,src.travel_timeframe,
       src.departure_date,src.return_date,src.budget_range,src.insurance_interest,
       src.special_requests,src.travel_interests,src.travel_seasons,src.inquiry_source,
       src.intake_method,'proposal_accepted',now())
    returning id into new_file;
    new_primary:=null;member_count:=0;
    for member in select * from public.travel_file_travellers
      where travel_file_id=p_source_id
      and (id=grp.recipient_party_member_id
        or booking_form_recipient_party_member_id=grp.recipient_party_member_id)
      order by case when id=grp.recipient_party_member_id then 0 else 1 end
    loop
      insert into public.travel_file_travellers
        (travel_file_id,traveller_profile_id,traveller_role,relationship_to_primary,
         receive_trip_communications,booking_form_required,booking_form_completed_at)
      values(new_file,member.traveller_profile_id,
        case when member.id=grp.recipient_party_member_id then 'primary' else 'traveller' end,
        member.relationship_to_primary,member.receive_trip_communications,
        member.booking_form_required,member.booking_form_completed_at)
      returning id into new_primary;
      member_count:=member_count+1;
    end loop;
    if member_count=0 then raise exception 'Empty accepted group'; end if;
    insert into public.travel_file_group_splits
      (source_travel_file_id,recipient_party_member_id,resulting_travel_file_id,
       decision,deposit_amount,source_retainer_payment_id,source_retainer_acceptance_id)
    values(p_source_id,grp.recipient_party_member_id,new_file,'accepted',
      grp.deposit_amount,payment_id,signed_id);
    created:=array_append(created,new_file);
  end loop;
  return jsonb_build_object('sourceTravelFileId',p_source_id,'newFileIds',to_jsonb(created),
    'createdCount',cardinality(created),'workflowPending',true);
end;
$$;
revoke all on function public.create_negotiated_group_files(uuid) from public,anon,authenticated;
grant execute on function public.create_negotiated_group_files(uuid) to service_role;
