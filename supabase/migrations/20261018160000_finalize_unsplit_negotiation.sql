-- Single Travel File negotiation finalization; no split or retainer ownership transfer.
-- Execute manually in Supabase SQL Editor before using the unsplit finalization button.
create or replace function public.finalize_unsplit_negotiation(p_source_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 src public.travel_files%rowtype;
 act public.travel_actions%rowtype;
 primary_id uuid;
 primary_deposit numeric;
 group_count integer;
 next_id uuid;
begin
 if auth.role()<>'service_role' then raise exception 'Service role required'; end if;
 select * into src from public.travel_files where id=p_source_id for update;
 if not found then raise exception 'Travel File not found'; end if;
 select * into act from public.travel_actions where id=src.current_action_id for update;
 if not found or act.action_code<>'negotiate_proposal' or act.status<>'active'
 then raise exception 'Negotiation is not active'; end if;
 if exists(select 1 from public.travel_file_group_splits where source_travel_file_id=p_source_id)
 then raise exception 'Travel File already split'; end if;
 select id into primary_id from public.travel_file_travellers
 where travel_file_id=p_source_id and traveller_role='primary';
 if primary_id is null then raise exception 'Primary traveller is missing'; end if;
 select count(*) into group_count from public.travel_group_retainers where travel_file_id=p_source_id;
 if group_count<>1 then raise exception 'Multiple Travel Groups require split finalization'; end if;
 if not exists(select 1 from public.travel_group_retainers
 where travel_file_id=p_source_id and recipient_party_member_id=primary_id)
 then raise exception 'Primary Travel Group record is missing'; end if;
 if exists(select 1 from public.travel_file_travellers
 where travel_file_id=p_source_id and booking_form_recipient_party_member_id is not null
 and booking_form_recipient_party_member_id<>primary_id)
 then raise exception 'Separate recipient group requires split finalization'; end if;
 select deposit_amount into primary_deposit from public.travel_group_negotiations
 where travel_file_id=p_source_id and recipient_party_member_id=primary_id and decision='accepted';
 if primary_deposit is null or primary_deposit<=0
 then raise exception 'Primary group must accept and have a positive deposit'; end if;
 if exists(select 1 from public.travel_group_negotiations
 where travel_file_id=p_source_id and recipient_party_member_id<>primary_id)
 then raise exception 'Multiple negotiation groups require split finalization'; end if;
 insert into public.travel_actions
 (travel_file_id,action_code,title,description,action_role,responsible_type,
 responsible_user_id,status,activated_at,metadata)
 values (p_source_id,'proposal_acceptance_deposit_agreement','Proposal and Deposit Agreement',
 'Send the deposit agreement for signature; do not mark the deposit paid.',
 act.action_role,act.responsible_type,act.responsible_user_id,'active',now(),
 jsonb_build_object('deposit_amount',primary_deposit))
 returning id into next_id;
 update public.travel_actions set status='completed',completed_at=now(),
 completion_event='unsplit_negotiation_finalized',updated_at=now() where id=act.id;
 update public.travel_files set current_action_id=next_id,stage='proposal_accepted',
 stage_changed_at=now() where id=p_source_id;
 return jsonb_build_object('finalized',true,'createdCount',0,'newFileIds',jsonb_build_array(),
 'sourceTravelFileId',p_source_id,'nextAction','proposal_acceptance_deposit_agreement');
end;
$$;
revoke all on function public.finalize_unsplit_negotiation(uuid) from public,anon,authenticated;
grant execute on function public.finalize_unsplit_negotiation(uuid) to service_role;
