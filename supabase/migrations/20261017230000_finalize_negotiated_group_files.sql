-- Replace the disabled draft with an atomic, service-only finalization transaction.
-- Apply AFTER 20261017210000_split_financial_provenance.sql and
-- 20261017220000_create_negotiated_group_files.sql.
create or replace function public.create_negotiated_group_files(p_source_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  src public.travel_files%rowtype;
  old_action public.travel_actions%rowtype;
  primary_id uuid;
  grp record;
  person record;
  new_file uuid;
  new_action uuid;
  primary_action uuid;
  signed_id uuid;
  payment_id uuid;
  created uuid[] := array[]::uuid[];
  expected_count integer;
  accepted_count integer;
  actual_count integer;
  moved_count integer;
  primary_payment uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  select * into src from public.travel_files where id=p_source_id for update;
  if not found then raise exception 'Travel File not found'; end if;
  select * into old_action from public.travel_actions where id=src.current_action_id for update;
  if not found or old_action.action_code<>'negotiate_proposal' or old_action.status<>'active'
    then raise exception 'Negotiation must be active'; end if;
  if exists(select 1 from public.travel_file_group_splits where source_travel_file_id=p_source_id)
    then raise exception 'File already split; no changes made'; end if;
  select id into primary_id from public.travel_file_travellers
    where travel_file_id=p_source_id and traveller_role='primary';
  if primary_id is null then raise exception 'Missing primary traveller'; end if;
  select count(*) into expected_count from public.travel_group_retainers where travel_file_id=p_source_id;
  select count(*) into actual_count from public.travel_group_negotiations where travel_file_id=p_source_id;
  if expected_count=0 or expected_count<>actual_count then raise exception 'Group records mismatch'; end if;
  if exists (
    select 1 from public.travel_group_retainers r
    left join public.travel_group_negotiations n on n.travel_file_id=r.travel_file_id
      and n.recipient_party_member_id=r.recipient_party_member_id
    where r.travel_file_id=p_source_id and
      (n.id is null or n.decision not in ('accepted','declined')
       or (n.decision='accepted' and coalesce(n.deposit_amount,0)<=0))
  ) then raise exception 'Outstanding or invalid group decision'; end if;
  if not exists(select 1 from public.travel_group_negotiations
    where travel_file_id=p_source_id and recipient_party_member_id=primary_id
      and decision='accepted') then raise exception 'Primary group must accept'; end if;
  if exists(select 1 from public.travel_file_travellers t where t.travel_file_id=p_source_id
    and t.id<>primary_id and t.booking_form_recipient_party_member_id is not null
    and not exists(select 1 from public.travel_group_retainers r
      where r.travel_file_id=p_source_id and r.recipient_party_member_id=t.booking_form_recipient_party_member_id))
    then raise exception 'Traveller references an unknown group'; end if;
  if exists(select 1 from public.travel_group_retainers r where r.travel_file_id=p_source_id
    and not exists(select 1 from public.travel_file_travellers t
      where t.id=r.recipient_party_member_id and t.travel_file_id=p_source_id))
    then raise exception 'Group recipient is missing'; end if;
  -- Validate all accepted groups, including the original primary, before writes.
  for grp in select n.* from public.travel_group_negotiations n
    where n.travel_file_id=p_source_id and n.decision='accepted'
  loop
    select a.id into signed_id from public.travel_group_retainer_acceptances a
      where a.travel_file_id=p_source_id and a.recipient_party_member_id=grp.recipient_party_member_id
      order by a.accepted_at desc limit 1;
    select l.payment_id into payment_id from public.travel_group_retainer_payments l
      join public.travel_payments p on p.id=l.payment_id and p.travel_file_id=p_source_id
      where l.travel_file_id=p_source_id and l.recipient_party_member_id=grp.recipient_party_member_id;
    if signed_id is null or payment_id is null
      then raise exception 'Accepted group lacks signed retainer or linked payment'; end if;
  end loop;
  for grp in select n.*, t.traveller_profile_id,
      p.first_name,p.last_name,p.briitely_contact_id
    from public.travel_group_negotiations n
    join public.travel_file_travellers t on t.id=n.recipient_party_member_id
      and t.travel_file_id=n.travel_file_id
    join public.traveller_profiles p on p.id=t.traveller_profile_id
    where n.travel_file_id=p_source_id and n.decision='accepted'
      and n.recipient_party_member_id<>primary_id
  loop
    if nullif(btrim(grp.briitely_contact_id),'') is null
      then raise exception 'Accepted group primary lacks Briitely contact'; end if;
    select a.id into signed_id from public.travel_group_retainer_acceptances a
      where a.travel_file_id=p_source_id and a.recipient_party_member_id=grp.recipient_party_member_id
      order by a.accepted_at desc limit 1;
    select l.payment_id into payment_id from public.travel_group_retainer_payments l
      where l.travel_file_id=p_source_id and l.recipient_party_member_id=grp.recipient_party_member_id;
    insert into public.travel_files
      (client_name,briitely_contact_id,assigned_advisor_id,destination,trip_type,
       travel_timeframe,departure_date,return_date,budget_range,insurance_interest,
       special_requests,travel_interests,travel_seasons,inquiry_source,intake_method,
       travefy_proposal_url,phase,stage,stage_changed_at)
    values (concat_ws(' ',grp.first_name,grp.last_name),grp.briitely_contact_id,
      src.assigned_advisor_id,src.destination,src.trip_type,src.travel_timeframe,
      src.departure_date,src.return_date,src.budget_range,src.insurance_interest,
      src.special_requests,src.travel_interests,src.travel_seasons,src.inquiry_source,
      src.intake_method,src.travefy_proposal_url,src.phase,'proposal_accepted',now())
    returning id into new_file;
    insert into public.travel_file_travellers
      (travel_file_id,traveller_profile_id,traveller_role,relationship_to_primary,
       receive_trip_communications,booking_form_required,booking_form_completed_at)
    select new_file,t.traveller_profile_id,
      case when t.id=grp.recipient_party_member_id then 'primary' else 'traveller' end,
      t.relationship_to_primary,t.receive_trip_communications,
      t.booking_form_required,t.booking_form_completed_at
    from public.travel_file_travellers t where t.travel_file_id=p_source_id
      and (t.id=grp.recipient_party_member_id
        or t.booking_form_recipient_party_member_id=grp.recipient_party_member_id);
    get diagnostics moved_count=row_count;
    if moved_count<1 then raise exception 'Accepted group has no travellers'; end if;
    -- Preserve payment ID and payment status; never create another charge.
    update public.travel_payments set travel_file_id=new_file,payment_group_id=null,
      updated_at=now() where id=payment_id and travel_file_id=p_source_id;
    if not found then raise exception 'Retainer payment transfer failed'; end if;
    insert into public.travel_file_group_splits
      (source_travel_file_id,recipient_party_member_id,resulting_travel_file_id,
       decision,deposit_amount,source_retainer_payment_id,source_retainer_acceptance_id,finalized_at)
    values(p_source_id,grp.recipient_party_member_id,new_file,'accepted',
      grp.deposit_amount,payment_id,signed_id,now());
    insert into public.travel_actions
      (travel_file_id,action_code,title,description,action_role,responsible_type,
       responsible_user_id,status,activated_at,metadata)
    values(new_file,'proposal_acceptance_deposit_agreement',
      'Proposal Acceptance & Deposit Agreement',
      'Send the group-specific deposit agreement for signature; do not mark the deposit paid.',
      old_action.action_role,old_action.responsible_type,old_action.responsible_user_id,
      'active',now(),jsonb_build_object('deposit_amount',grp.deposit_amount,
        'source_travel_file_id',p_source_id,'source_recipient_party_member_id',grp.recipient_party_member_id))
    returning id into new_action;
    update public.travel_files set current_action_id=new_action where id=new_file;
    created:=array_append(created,new_file);
  end loop;
  select n.deposit_amount into primary_payment from public.travel_group_negotiations n
    where n.travel_file_id=p_source_id and n.recipient_party_member_id=primary_id;
  update public.travel_actions set status='completed',completed_at=now(),
    completion_event='negotiated_group_split_finalized',updated_at=now()
    where id=old_action.id;
  insert into public.travel_actions
    (travel_file_id,action_code,title,description,action_role,responsible_type,
     responsible_user_id,status,activated_at,metadata)
  values(p_source_id,'proposal_acceptance_deposit_agreement',
    'Proposal Acceptance & Deposit Agreement',
    'Send the primary group deposit agreement for signature; do not mark the deposit paid.',
    old_action.action_role,old_action.responsible_type,old_action.responsible_user_id,
    'active',now(),jsonb_build_object('deposit_amount',primary_payment))
  returning id into primary_action;
  update public.travel_files set current_action_id=primary_action,
    stage='proposal_accepted',stage_changed_at=now() where id=p_source_id;
  return jsonb_build_object('sourceTravelFileId',p_source_id,'newFileIds',to_jsonb(created),
    'createdCount',cardinality(created),'finalized',true,
    'nextAction','proposal_acceptance_deposit_agreement');
end;
$$;
revoke all on function public.create_negotiated_group_files(uuid) from public,anon,authenticated;
grant execute on function public.create_negotiated_group_files(uuid) to service_role;
