import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

interface Body { advisorId?: string; dueDate?: string }

export async function POST(request:Request,{params}:{params:Promise<{travelFileId:string}>}){
  const{user}=await getAuthenticatedUser();
  if(!user||!user.isActive)return NextResponse.json({error:"Authentication required."},{status:401});
  if(!["staff","admin","super_admin"].includes(user.role))return NextResponse.json({error:"Staff access required."},{status:403});

  const{travelFileId}=await params;
  const body=(await request.json().catch(()=>({}))) as Body;
  if(!body.advisorId)return NextResponse.json({error:"Proposal advisor is required."},{status:400});
  if(!body.dueDate)return NextResponse.json({error:"Proposal review due date is required."},{status:400});

  const supabase=await createClient();
  const{data:file,error:fileError}=await supabase.from("travel_files")
    .select("id,stage,current_action_id,current_action:travel_actions!current_action_id(id,action_code,status)")
    .eq("id",travelFileId).maybeSingle();
  if(fileError||!file)return NextResponse.json({error:"Travel File not found."},{status:404});
  const action=Array.isArray(file.current_action)?file.current_action[0]:file.current_action;
  if(!action||action.action_code!=="assign_proposal"||action.status!=="active")return NextResponse.json({error:"Assign Proposal is not the active action for this Travel File."},{status:409});

  const{data:advisor}=await supabase.from("profiles").select("id,full_name,is_active").eq("id",body.advisorId).maybeSingle();
  if(!advisor?.is_active)return NextResponse.json({error:"Select an active advisor."},{status:400});

  const now=new Date().toISOString();
  const dueAt=`${body.dueDate}T23:59:59`;
  const{data:next,error:nextError}=await supabase.from("travel_actions").insert({
    travel_file_id:travelFileId,
    action_code:"create_proposal",
    title:"Create Proposal",
    description:"Create the proposal in Travefy and prepare it for review.",
    action_role:"blocking",
    responsible_type:"internal",
    responsible_user_id:body.advisorId,
    status:"active",
    due_at:dueAt,
    waiting_since:now,
    activated_at:now,
    metadata:{trigger:"proposal_assigned",assigned_by:user.id},
  }).select("id").single();
  if(nextError||!next)return NextResponse.json({error:"Could not create the Create Proposal action."},{status:500});

  const{data:updated,error:updateError}=await supabase.from("travel_files").update({
    assigned_advisor_id:body.advisorId,
    proposal_due_date:body.dueDate,
    current_action_id:next.id,
    stage:"planning_proposal",
    stage_changed_at:now,
  }).eq("id",travelFileId).eq("current_action_id",action.id).select("id").maybeSingle();
  if(updateError||!updated){await supabase.from("travel_actions").delete().eq("id",next.id);return NextResponse.json({error:"Could not assign the proposal."},{status:500});}

  await supabase.from("travel_actions").update({status:"completed",completed_at:now,completed_by:user.id,completion_source:"portal",completion_event:"proposal_assigned"}).eq("id",action.id);
  await supabase.from("travel_activity").insert({travel_file_id:travelFileId,event_type:"proposal_assigned",summary:`Proposal assigned to ${advisor.full_name} for review by ${body.dueDate}.`,actor_type:"internal",actor_user_id:user.id,action_id:action.id,previous_stage:file.stage,new_stage:"planning_proposal",metadata:{advisor_id:body.advisorId,proposal_due_date:body.dueDate}});

  return NextResponse.json({success:true,nextActionId:next.id});
}
