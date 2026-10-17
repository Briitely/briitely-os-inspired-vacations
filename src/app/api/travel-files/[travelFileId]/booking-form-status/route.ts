import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(_req:Request,{params}:{params:Promise<{travelFileId:string}>}){
  const{user}=await getAuthenticatedUser();
  if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
  const{travelFileId}=await params;
  const supabase=await createClient();
  const[{data:party,error:partyError},{data:sessions,error:sessionError},{data:acceptance,error:acceptanceError},{count:unreviewedChangeCount,error:reviewError}]=await Promise.all([
    supabase.from("travel_file_travellers").select("id,booking_form_recipient_party_member_id").eq("travel_file_id",travelFileId),
    supabase.from("booking_form_sessions").select("id,include_retainer,recipient_party_member_id,completed_at,revoked_at,created_at").eq("travel_file_id",travelFileId).is("revoked_at",null).order("created_at",{ascending:false}),
    supabase.from("retainer_acceptances").select("id,accepted_at").eq("travel_file_id",travelFileId).order("accepted_at",{ascending:false}).limit(1).maybeSingle(),
    supabase.from("booking_form_submissions").select("id",{count:"exact",head:true}).eq("travel_file_id",travelFileId).gt("change_count",0).is("reviewed_at",null),
  ]);
  if(partyError||sessionError||acceptanceError||reviewError)return NextResponse.json({error:(partyError||sessionError||acceptanceError||reviewError)?.message??"Could not load booking form status."},{status:500});
  const {data:groupAcceptances,error:groupAcceptanceError}=await supabase.from("travel_group_retainer_acceptances").select("recipient_party_member_id,accepted_at").eq("travel_file_id",travelFileId);if(groupAcceptanceError)return NextResponse.json({error:groupAcceptanceError.message},{status:500});const acceptedGroupIds=Array.from(new Set((groupAcceptances??[]).filter(x=>x.accepted_at).map(x=>x.recipient_party_member_id)));const recipientIds=Array.from(new Set((party??[]).map(x=>x.booking_form_recipient_party_member_id).filter(Boolean))) as string[];
  const primaryPrepared=(sessions??[]).some(s=>s.include_retainer===true&&s.recipient_party_member_id==null);
  const primaryBookingPrepared=(sessions??[]).some(s=>s.recipient_party_member_id==null);
  const preparedRecipientIds=recipientIds.filter(id=>(sessions??[]).some(s=>s.recipient_party_member_id===id));
  const {data:sentEmails,error:sentEmailError}=await supabase.from("travel_activity").select("metadata").eq("travel_file_id",travelFileId).eq("event_type","client_email_sent");if(sentEmailError)return NextResponse.json({error:sentEmailError.message},{status:500});const sentRecipientIds=Array.from(new Set((sentEmails??[]).map(e=>(e.metadata as any)?.recipient_party_member_id).filter(Boolean))) as string[];const primaryId=(party??[]).find((p:any)=>!p.booking_form_recipient_party_member_id)?.id;const primaryEmailSent=Boolean(primaryId&&sentRecipientIds.includes(primaryId));
  return NextResponse.json({primaryEmailSent,sentRecipientIds,unreviewedChangeCount:unreviewedChangeCount??0,primaryPrepared,primaryBookingPrepared,recipientIds,preparedRecipientIds,acceptedGroupIds,retainerAccepted:Boolean(acceptance?.accepted_at)});
}
