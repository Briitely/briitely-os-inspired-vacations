-- Atomically record a completed trip in client profiles exactly once.
-- A row lock on travel_files serializes competing cron runs and date-edit requests.
create or replace function public.record_travel_file_trip_history(p_travel_file_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_file public.travel_files%rowtype;
  v_contact text;
  v_value numeric;
begin
  select * into v_file from public.travel_files
  where id = p_travel_file_id for update;
  if not found then raise exception 'Travel file % not found', p_travel_file_id; end if;
  if v_file.file_status <> 'open'
     or v_file.return_date is null
     or v_file.return_date >= (now() at time zone 'America/Edmonton')::date
     or v_file.client_rollup_recorded_at is not null then
    return false;
  end if;

  -- Lock the client profile rows to serialize increments on shared contacts.
  -- Unique contacts count as one trip, regardless of multiple traveller records.
  for v_contact, v_value in
    with members as (
      select distinct t.id as member_id, nullif(btrim(p.briitely_contact_id), '') as contact_id
      from public.travel_file_travellers t
      join public.traveller_profiles p on p.id = t.traveller_profile_id
      where t.travel_file_id = p_travel_file_id
    ), recipients as (
      select g.id as group_id, m.contact_id
      from public.travel_payment_groups g
      join members m on m.member_id = g.payment_email_recipient_traveller_id
      where g.travel_file_id = p_travel_file_id
    ), amounts as (
      select r.contact_id, sum(coalesce(pay.amount,0)) as total
      from public.travel_payments pay
      join recipients r on r.group_id = pay.payment_group_id
      where pay.travel_file_id = p_travel_file_id and pay.status <> 'cancelled'
      group by r.contact_id
    )
    select distinct m.contact_id, coalesce(a.total,0)
    from members m left join amounts a on a.contact_id=m.contact_id
    where m.contact_id is not null
    order by m.contact_id
  loop
    insert into public.client_travel_profiles
      (briitely_contact_id, number_of_trips, lifetime_value, last_travel_destination, last_travel_date)
    values (v_contact, 1, v_value, v_file.destination, v_file.return_date)
    on conflict (briitely_contact_id) do update set
      number_of_trips = coalesce(public.client_travel_profiles.number_of_trips,0)+1,
      lifetime_value = coalesce(public.client_travel_profiles.lifetime_value,0)+excluded.lifetime_value,
      last_travel_destination=excluded.last_travel_destination,
      last_travel_date=excluded.last_travel_date;
  end loop;
  update public.travel_files set client_rollup_recorded_at=now() where id=p_travel_file_id;
  return true;
end;
$$;
revoke all on function public.record_travel_file_trip_history(uuid) from public, anon, authenticated;
grant execute on function public.record_travel_file_trip_history(uuid) to service_role;
