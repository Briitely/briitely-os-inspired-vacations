import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(_request: Request,{params}:{params:Promise<{travelFileId:string}>}){
  const{user}=await getAuthenticatedUser();
  if(!user||!user.isActive)return NextResponse.json({error:"Authentication required."},{status:401});
  if(!["staff","admin","super_admin"].includes(user.role))return NextResponse.json({error:"Staff access required."},{status:403});

  const{travelFileId}=await params;
  const supabase=await createClient();
  const{data:file,error:fileError}=await supabase
    .from("travel_files")
    .select("id,stage,current_action_id,assigned_advisor_id,current_action:travel_actions!current_action_id(id,action_code,status,responsible_user_id)")
    .eq("id",travelFileId)
    .maybeSingle();
  if(fileError||!file)return NextResponse.json({error:"Travel File not found."},{status:404});

  const action=Array.isArray(file.current_action)?file.current_action[0]:file.current_action;
  if(!action||action.action_code!=="collect_tmf_payment"||action.status!=="active"){
    return NextResponse.json({error:"Collect Retainer Payment is not the active action for this Travel File."},{status:409});
  }

  const now=new Date().toISOString();
  const ownerId=file.assigned_advisor_id||action.responsible_user_id||user.id;
  const{data:nextAction,error:nextError}=await supabase.from("travel_actions").insert({
    travel_file_id:travelFileId,
    action_code:"create_proposal",
    title:"Create Proposal",
    action_role:"blocking",
    responsible_type:"internal",
    responsible_user_id:ownerId,
    status:"active",
    waiting_since:now,
    activated_at:now,
    metadata:{trigger:"retainer_received"},
  }).select("id").single();
  if(nextError||!nextAction)return NextResponse.json({error:"Could not create the next workflow action."},{status:500});

  const{error:updateError}=await supabase.from("travel_files").update({
    stage:"planning_proposal",
    stage_changed_at:now,
    current_action_id:nextAction.id,
  }).eq("id",travelFileId);
  if(updateError){
    await supabase.from("travel_actions").delete().eq("id",nextAction.id);
    return NextResponse.json({error:"Could not advance the Travel File."},{status:500});
  }

  await supabase.from("travel_actions").update({
    status:"completed",
    completed_at:now,
    completed_by:user.id,
    completion_source:"manual_external",
    completion_event:"retainer_received",
  }).eq("id",action.id);

  await supabase.from("travel_activity").insert({
    travel_file_id:travelFileId,
    event_type:"retainer_received",
    summary:"Retainer payment marked received.",
    actor_type:"internal",
    actor_user_id:user.id,
    action_id:action.id,
    previous_stage:file.stage,
    new_stage:"planning_proposal",
    metadata:{source:"manual_external"},
  });

  return NextResponse.json({success:true,stage:"planning_proposal",nextActionId:nextAction.id});
}
