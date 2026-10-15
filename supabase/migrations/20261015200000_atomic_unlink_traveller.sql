-- Delete an unlinked traveller only if there are no other references.
-- All checks and deletions happen within one PostgreSQL transaction.
create or replace function public.delete_unlinked_traveller(
  p_primary_contact_id text,
  p_relationship_id uuid
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile_id uuid;
  v_contact_id text;
  v_ref record;
  v_count bigint;
begin
  select cr.related_traveller_id into v_profile_id
  from public.client_relationships cr
  where cr.id=p_relationship_id and cr.primary_contact_id=p_primary_contact_id
  for update;
  if v_profile_id is null then raise exception 'Relationship not found'; end if;
  select tp.briitely_contact_id into v_contact_id
  from public.traveller_profiles tp where tp.id=v_profile_id for update;
  if not found then raise exception 'Traveller not found'; end if;
  if v_contact_id is not null then raise exception 'Traveller has a separate client file; unlink instead'; end if;
  select count(*) into v_count from public.client_relationships
  where related_traveller_id=v_profile_id;
  if v_count<>1 then raise exception 'Traveller has other relationships; deletion blocked'; end if;
  -- Discover all direct FK references, including new tables added later.
  -- Fail closed on any reference except the one relationship being deleted.
  for v_ref in
    select n.nspname as schema_name, c.relname as table_name, a.attname as column_name
    from pg_constraint fk
    join pg_class c on c.oid=fk.conrelid
    join pg_namespace n on n.oid=c.relnamespace
    join pg_attribute a on a.attrelid=fk.conrelid and a.attnum=fk.conkey[1]
    where fk.contype='f' and fk.confrelid='public.traveller_profiles'::regclass
      and array_length(fk.conkey,1)=1
  loop
    if v_ref.schema_name='public' and v_ref.table_name='client_relationships' and v_ref.column_name='related_traveller_id' then
      continue;
    end if;
    execute format('select count(*) from %I.%I where %I=$1',v_ref.schema_name,v_ref.table_name,v_ref.column_name)
      into v_count using v_profile_id;
    if v_count>0 then raise exception 'Traveller has linked records in %.%; create a separate client file instead',v_ref.schema_name,v_ref.table_name; end if;
  end loop;
  delete from public.client_relationships where id=p_relationship_id and primary_contact_id=p_primary_contact_id;
  delete from public.traveller_profiles where id=v_profile_id and briitely_contact_id is null;
  if not found then raise exception 'Traveller could not be deleted'; end if;
  return true;
end;
$$;
revoke all on function public.delete_unlinked_traveller(text,uuid) from public;
revoke all on function public.delete_unlinked_traveller(text,uuid) from anon;
grant execute on function public.delete_unlinked_traveller(text,uuid) to authenticated;
