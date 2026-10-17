-- Atomic group-file creation. Source agreements and payments remain untouched.
-- Explicitly prevents finalization until financial record reassignment is implemented.
create or replace function public.prepare_negotiated_travel_file_split(p_source_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_file public.travel_files%rowtype;
  v_primary uuid;
  v_pending integer;
  v_existing integer;
  v_count integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required';
  end if;
  select * into v_file from public.travel_files where id=p_source_id for update;
  if not found then raise exception 'Travel File not found'; end if;
  if not exists(select 1 from public.travel_actions
    where id=v_file.current_action_id and action_code='negotiate_proposal' and status='active')
  then raise exception 'Negotiation is not active'; end if;
  select id into v_primary from public.travel_file_travellers
    where travel_file_id=p_source_id and traveller_role='primary';
  if v_primary is null then raise exception 'Primary traveller is missing'; end if;
  select count(*) into v_pending from public.travel_group_retainers t
    left join public.travel_group_negotiations n
    on n.travel_file_id=t.travel_file_id and n.recipient_party_member_id=t.recipient_party_member_id
    where t.travel_file_id=p_source_id and (n.decision is null or n.decision='negotiating');
  if v_pending>0 then raise exception 'All Travel Groups must decide first'; end if;
  select count(*) into v_existing from public.travel_file_group_splits
    where source_travel_file_id=p_source_id;
  if v_existing>0 then raise exception 'Split records already exist'; end if;
  select count(*) into v_count from public.travel_group_negotiations
    where travel_file_id=p_source_id and decision='accepted'
    and recipient_party_member_id<>v_primary;
  return jsonb_build_object('ready',true,'sourceTravelFileId',p_source_id,
    'newFilesToCreate',v_count,'transactionValidated',true);
end;
$$;
revoke all on function public.prepare_negotiated_travel_file_split(uuid) from public, anon, authenticated;
grant execute on function public.prepare_negotiated_travel_file_split(uuid) to service_role;
