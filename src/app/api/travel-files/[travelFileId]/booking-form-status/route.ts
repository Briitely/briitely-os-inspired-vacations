import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(_req:Request,{params}:{params:Promise<{travelFileId:string}>}){
  const{user}=await getAuthenticatedUser();
  if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
  const{travelFileId}=await params;
  const supabase=await createClient();
  const[{data:party,error:partyError},{data:sessions,error:sessionError},{data:acceptance,error:acceptanceError}]=await Promise.all([
    supabase.from("travel_file_travellers").select("id,booking_form_recipient_party_member_id").eq("travel_file_id",travelFileId),
    supabase.from("booking_form_sessions").select("id,include_retainer,recipient_party_member_id,completed_at,revoked_at,created_at").eq("travel_file_id",travelFileId).is("revoked_at",null).order("created_at",{ascending:false}),
    supabase.from("retainer_acceptances").select("id,accepted_at").eq("travel_file_id",travelFileId).order("accepted_at",{ascending:false}).limit(1).maybeSingle(),
  ]);
  if(partyError||sessionError||acceptanceError)return NextResponse.json({error:(partyError||sessionError||acceptanceError)?.message??"Could not load booking form status."},{status:500});
  const recipientIds=Array.from(new Set((party??[]).map(x=>x.booking_form_recipient_party_member_id).filter(Boolean))) as string[];
  const primaryPrepared=(sessions??[]).some(s=>s.include_retainer===true&&s.recipient_party_member_id==null);
  const primaryBookingPrepared=(sessions??[]).some(s=>s.recipient_party_member_id==null);
  const preparedRecipientIds=recipientIds.filter(id=>(sessions??[]).some(s=>s.include_retainer===false&&s.recipient_party_member_id===id));
  return NextResponse.json({primaryPrepared,primaryBookingPrepared,recipientIds,preparedRecipientIds,retainerAccepted:Boolean(acceptance?.accepted_at)});
}
