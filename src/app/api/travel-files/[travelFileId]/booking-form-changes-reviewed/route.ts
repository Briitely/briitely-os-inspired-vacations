import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(_req:Request,{params}:{params:Promise<{travelFileId:string}>}){
  const {user}=await getAuthenticatedUser();
  if(!user||!user.isActive)return NextResponse.json({error:"Unauthorized"},{status:401});
  const {travelFileId}=await params;
  const db=await createClient();
  const {data:file,error:fileError}=await db.from("travel_files").select("current_action_id").eq("id",travelFileId).maybeSingle();
  if(fileError||!file?.current_action_id)return NextResponse.json({error:fileError?.message??"No current action."},{status:400});
  const now=new Date().toISOString();
  const {data:req,error}=await db.from("travel_action_requirements").update({status:"complete",completed_at:now,completed_by:user.id}).eq("travel_action_id",file.current_action_id).eq("requirement_code","review_booking_form_changes").select("id").maybeSingle();
  if(error)return NextResponse.json({error:error.message},{status:500});
  if(!req)return NextResponse.json({error:"No pending booking form changes review was found."},{status:404});
  await db.from("travel_activity").insert({travel_file_id:travelFileId,event_type:"booking_form_changes_reviewed",summary:"Booking form changes were reviewed and cleared.",actor_type:"internal",actor_user_id:user.id,action_id:file.current_action_id});
  return NextResponse.json({reviewed:true});
}
