import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(_request:Request,{params}:{params:Promise<{travelFileId:string}>}){
  const {user}=await getAuthenticatedUser();
  if(!user||!user.isActive)return NextResponse.json({error:"Authentication required."},{status:401});
  if(!["staff","admin","super_admin"].includes(user.role))return NextResponse.json({error:"Staff access required."},{status:403});
  const {travelFileId}=await params;
  const db=await createClient();
  const {data:file,error}=await db.from("travel_files").select("id,file_status,stage,current_action_id,current_action:travel_actions!current_action_id(id,action_code,status)").eq("id",travelFileId).maybeSingle();
  if(error||!file)return NextResponse.json({error:"Travel File not found."},{status:404});
  if(file.file_status==="closed")return NextResponse.json({success:true,alreadyClosed:true});
  const current=Array.isArray(file.current_action)?file.current_action[0]:file.current_action;
  if(file.file_status!=="open"||file.stage!=="post_trip"||!current||current.action_code!=="post_trip_close_file"||current.status!=="active")
    return NextResponse.json({error:"Post-Trip / Close File is not the active action."},{status:409});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if(!url||!key)return NextResponse.json({error:"File closure is not configured."},{status:500});
  const serviceDb=createSupabaseClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:closed,error:closeError}=await serviceDb.rpc("close_travel_file_with_history",{p_travel_file_id:travelFileId,p_closed_by:user.id});
  if(closeError)return NextResponse.json({error:"Could not close Travel File and record trip history: "+closeError.message},{status:500});
  return NextResponse.json({success:true,alreadyClosed:!closed,stage:"travel_complete"});
}
