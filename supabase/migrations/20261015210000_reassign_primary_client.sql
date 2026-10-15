create or replace function public.reassign_travel_file_primary(p_file_id uuid,p_new_profile_id uuid,p_actor_id uuid) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare f record; t record;
begin
 select id,briitely_contact_id,client_name,file_status,stage into f from public.travel_files where id=p_file_id for update;
 if not found or f.file_status <> 'open' then raise exception 'Travel File must be open'; end if;
 select id,briitely_contact_id,first_name,last_name,is_deceased into t from public.traveller_profiles where id=p_new_profile_id;
 if not found or t.briitely_contact_id is null then raise exception 'Create a separate client file for this traveller first'; end if;
 if t.is_deceased then raise exception 'Cannot assign a deceased primary client'; end if;
 if not exists(select 1 from public.travel_file_travellers where travel_file_id=p_file_id and traveller_profile_id=p_new_profile_id) then raise exception 'Select a member of the travel party'; end if;
 if f.briitely_contact_id=t.briitely_contact_id then return false; end if;
 update public.travel_file_travellers set traveller_role='traveller',relationship_to_primary=null where travel_file_id=p_file_id and traveller_role='primary';
 update public.travel_file_travellers set traveller_role='primary',relationship_to_primary='primary',receive_trip_communications=true where travel_file_id=p_file_id and traveller_profile_id=p_new_profile_id;
 update public.travel_files set briitely_contact_id=t.briitely_contact_id,client_name=concat_ws(' ',t.first_name,t.last_name) where id=p_file_id;
 insert into public.travel_activity(travel_file_id,event_type,summary,actor_type,actor_user_id,previous_stage,new_stage,metadata)
 values(p_file_id,'primary_client_reassigned','Primary client reassigned from '||coalesce(f.client_name,'Unknown')||' to '||concat_ws(' ',t.first_name,t.last_name),'internal',p_actor_id,f.stage,f.stage,jsonb_build_object('previous_contact_id',f.briitely_contact_id,'new_contact_id',t.briitely_contact_id,'new_profile_id',p_new_profile_id));
 return true;
end;$$;
revoke all on function public.reassign_travel_file_primary(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.reassign_travel_file_primary(uuid,uuid,uuid) to service_role;
