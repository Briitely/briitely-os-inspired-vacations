import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: Request,{params}:{params:Promise<{travelFileId:string}>}){
 const {user}=await getAuthenticatedUser();
 if(!user||!user.isActive)return NextResponse.json({error:"Authentication required."},{status:401});
 const {travelFileId}=await params;
 let body:{dueAt?:string|null;notes?:string|null};try{body=await request.json()}catch{return NextResponse.json({error:"Invalid request."},{status:400})}
 const supabase=await createClient();
 const {data:file}=await supabase.from("travel_files").select("id,current_action_id").eq("id",travelFileId).maybeSingle();
 if(!file?.current_action_id)return NextResponse.json({error:"This Travel File does not have a current action."},{status:404});
 const updates:Record<string,string|null>={};
 if(Object.prototype.hasOwnProperty.call(body,"dueAt"))updates.due_at=body.dueAt||null;
 if(Object.prototype.hasOwnProperty.call(body,"notes"))updates.notes=body.notes?.trim()||null;
 if(!Object.keys(updates).length)return NextResponse.json({error:"No changes provided."},{status:400});
 const {data:action,error}=await supabase.from("travel_actions").update(updates).eq("id",file.current_action_id).eq("travel_file_id",travelFileId).select("*").single();
 if(error)return NextResponse.json({error:"Could not update the current action."},{status:500});
 await supabase.from("travel_activity").insert({travel_file_id:travelFileId,event_type:"current_action_adjusted",summary:"Current action timing or note updated",actor_type:"internal",actor_user_id:user.id,action_id:file.current_action_id,metadata:{fields:Object.keys(updates)}});
 return NextResponse.json({action});
}
