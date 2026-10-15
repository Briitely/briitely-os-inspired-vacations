create or replace function public.reassign_travel_file_primary(p_file_id uuid,p_new_profile_id uuid,p_actor_id uuid,p_remove_previous boolean default false) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare f record; t record; old_profile uuid; old_member uuid; old_deceased boolean;
begin
 select id,briitely_contact_id,client_name,file_status,stage into f from public.travel_files where id=p_file_id for update;
 if not found or f.file_status <> 'open' then raise exception 'Travel File must be open'; end if;
 select id,briitely_contact_id,first_name,last_name,is_deceased into t from public.traveller_profiles where id=p_new_profile_id;
 if not found or t.briitely_contact_id is null then raise exception 'Create a separate client file for this traveller first'; end if;
 if t.is_deceased then raise exception 'Cannot assign a deceased primary client'; end if;
 if not exists(select 1 from public.travel_file_travellers where travel_file_id=p_file_id and traveller_profile_id=p_new_profile_id) then raise exception 'Select a member of the travel party'; end if;
 if f.briitely_contact_id=t.briitely_contact_id then return false; end if;
 select id,is_deceased into old_profile,old_deceased from public.traveller_profiles where briitely_contact_id=f.briitely_contact_id;
 if coalesce(old_deceased,false) and not p_remove_previous then raise exception 'A deceased primary traveller must be removed from the trip'; end if;
 select id into old_member from public.travel_file_travellers where travel_file_id=p_file_id and traveller_profile_id=old_profile;
 update public.travel_file_travellers set traveller_role='traveller',relationship_to_primary=null where travel_file_id=p_file_id and traveller_role='primary';
 update public.travel_file_travellers set traveller_role='primary',relationship_to_primary='primary',receive_trip_communications=true where travel_file_id=p_file_id and traveller_profile_id=p_new_profile_id;
 update public.travel_files set briitely_contact_id=t.briitely_contact_id,client_name=concat_ws(' ',t.first_name,t.last_name) where id=p_file_id;
 if p_remove_previous and old_member is not null then
   update public.travel_file_travellers set booking_form_recipient_party_member_id=null,booking_form_required=false where travel_file_id=p_file_id and booking_form_recipient_party_member_id=old_member;
   delete from public.travel_file_travellers where id=old_member;
 end if;
 insert into public.travel_activity(travel_file_id,event_type,summary,actor_type,actor_user_id,previous_stage,new_stage,metadata)
 values(p_file_id,'primary_client_reassigned','Primary client reassigned from '||coalesce(f.client_name,'Unknown')||' to '||concat_ws(' ',t.first_name,t.last_name)||case when p_remove_previous then '; original traveller removed from trip.' else '; original traveller retained on trip.' end,'internal',p_actor_id,f.stage,f.stage,jsonb_build_object('previous_contact_id',f.briitely_contact_id,'new_contact_id',t.briitely_contact_id,'previous_profile_id',old_profile,'new_profile_id',p_new_profile_id,'removed_previous',p_remove_previous));
 return true;
end;$$;
revoke all on function public.reassign_travel_file_primary(uuid,uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.reassign_travel_file_primary(uuid,uuid,uuid,boolean) to service_role;
