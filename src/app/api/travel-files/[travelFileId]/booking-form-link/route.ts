import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { BOOKING_FORM_TTL_DAYS, hashBookingFormToken, newBookingFormToken } from "@/lib/travel/booking-form";

export async function POST(req: Request,{params}:{params:Promise<{travelFileId:string}>}){
 try{
  const{user,error:authError}=await getAuthenticatedUser();if(authError||!user||!user.isActive)return NextResponse.json({error:"Unauthorized"},{status:401});
  const{travelFileId}=await params;const body=await req.json().catch(()=>({})) as {partyMemberId?:string};const supabase=await createClient();
  const{data:file,error:fileError}=await supabase.from("travel_files").select("id,destination").eq("id",travelFileId).maybeSingle();if(fileError)return NextResponse.json({error:fileError.message},{status:500});if(!file)return NextResponse.json({error:"Travel File not found."},{status:404});
  let recipient:any=null;
  if(body.partyMemberId){
   const{data,error}=await supabase.from("travel_file_travellers").select("id,booking_form_required,traveller_profiles:traveller_profile_id(id,first_name,last_name,preferred_name,email)").eq("id",body.partyMemberId).eq("travel_file_id",travelFileId).maybeSingle();
   if(error)return NextResponse.json({error:error.message},{status:500});if(!data)return NextResponse.json({error:"Traveller not found on this Travel File."},{status:404});
   const p=Array.isArray(data.traveller_profiles)?data.traveller_profiles[0]:data.traveller_profiles;
   if(!data.booking_form_required)return NextResponse.json({error:"This traveller is not marked for a separate booking form."},{status:400});
   if(!p?.email?.trim())return NextResponse.json({error:"This traveller needs an email address before a separate booking form can be sent."},{status:400});
   recipient={partyMemberId:data.id,name:[p.preferred_name||p.first_name,p.last_name].filter(Boolean).join(" "),email:p.email};
  }
  const now=new Date().toISOString();
  if(recipient)await supabase.from("booking_form_sessions").update({revoked_at:now}).eq("travel_file_id",travelFileId).eq("recipient_party_member_id",recipient.partyMemberId).is("completed_at",null).is("revoked_at",null);
  const token=newBookingFormToken();const expiresAt=new Date(Date.now()+BOOKING_FORM_TTL_DAYS*86400000).toISOString();
  const{error}=await supabase.from("booking_form_sessions").insert({travel_file_id:travelFileId,token_hash:hashBookingFormToken(token),expires_at:expiresAt,created_by:user.id,include_retainer:false,recipient_party_member_id:recipient?.partyMemberId??null});if(error)return NextResponse.json({error:error.message},{status:500});
  const origin=new URL(req.url).origin;return NextResponse.json({url:`${origin}/booking/${encodeURIComponent(token)}`,expiresAt,includeRetainer:false,recipient,destination:file.destination??null});
 }catch(error){console.error("BOOKING_FORM_LINK_CREATE_FAILED",error);return NextResponse.json({error:error instanceof Error?error.message:"Could not create booking form link."},{status:500})}
}
