import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

interface OverrideBody {actionCode:string;responsibleUserId?:string|null;dueAt?:string|null;}
const OPTIONS:{stage:string;actionCode:string;title:string;responsibleType:"client"|"internal"|"system"}[]=[
{stage:"new_inquiry",actionCode:"book_initial_consultation",title:"Book Initial Consultation",responsibleType:"client"},
{stage:"consult_booked",actionCode:"complete_initial_consultation",title:"Complete Initial Consultation",responsibleType:"internal"},
{stage:"consultation_complete",actionCode:"send_tmf_agreement",title:"Prepare Retainer Email",responsibleType:"internal"},
{stage:"tmf_sent",actionCode:"await_tmf_and_booking_form",title:"Await Retainer Agreement / Booking Forms",responsibleType:"client"},
{stage:"tmf_processing",actionCode:"collect_tmf_payment",title:"Collect Retainer Payment",responsibleType:"internal"},
{stage:"planning_proposal",actionCode:"assign_proposal",title:"Assign Proposal",responsibleType:"internal"},
{stage:"planning_proposal",actionCode:"create_proposal",title:"Create Proposal",responsibleType:"internal"},
{stage:"planning_proposal",actionCode:"send_proposal",title:"Send Proposal",responsibleType:"internal"},
{stage:"proposal_sent",actionCode:"check_proposal_status",title:"Check Proposal Status",responsibleType:"internal"},
{stage:"negotiating",actionCode:"negotiate_proposal",title:"Negotiate Proposal",responsibleType:"internal"},
{stage:"proposal_accepted",actionCode:"complete_booking",title:"Complete Booking",responsibleType:"internal"},
{stage:"booking_confirmed",actionCode:"invoicing_itinerary",title:"Invoicing & Itinerary",responsibleType:"internal"},
{stage:"booking_confirmed",actionCode:"waiting_for_travel",title:"Waiting for Travel",responsibleType:"system"},
{stage:"post_trip",actionCode:"post_trip_close_file",title:"Post-Trip / Close File",responsibleType:"internal"}];

export async function POST(request:Request,{params}:{params:Promise<{travelFileId:string}>}){
 const{user}=await getAuthenticatedUser();
 if(!user)return NextResponse.json({error:"Authentication required."},{status:401});
 if(user.role!=="admin"&&user.role!=="super_admin")return NextResponse.json({error:"Admin access required."},{status:403});
 const{travelFileId}=await params;
 let body:OverrideBody;
 try{body=await request.json() as OverrideBody}catch{return NextResponse.json({error:"Invalid request body."},{status:400})}
 const option=OPTIONS.find(x=>x.actionCode===body.actionCode);
 if(!option)return NextResponse.json({error:"Invalid workflow step."},{status:400});
 if(option.responsibleType==="internal"&&!body.responsibleUserId)return NextResponse.json({error:"Responsible user is required for this workflow step."},{status:400});
 const supabase=await createClient();
 if(option.responsibleType==="internal"){
  const{data:advisor}=await supabase.from("profiles").select("id,is_active").eq("id",body.responsibleUserId).maybeSingle();
  if(!advisor?.is_active)return NextResponse.json({error:"Select an active responsible user."},{status:400});
 }
 const{data:rawFile,error:fileError}=await supabase.from("travel_files").select("id,stage,current_action_id,current_action:travel_actions!current_action_id(id,action_code,status)").eq("id",travelFileId).maybeSingle();
 if(fileError||!rawFile)return NextResponse.json({error:"Travel File not found."},{status:404});
 const file=rawFile as{id:string;stage:string;current_action_id:string|null;current_action:{id:string;action_code:string;status:string}|null};
 const now=new Date().toISOString(),previousStage=file.stage,previousActionCode=file.current_action?.action_code??null;
 if(file.current_action_id)await supabase.from("travel_actions").update({status:"skipped",completion_source:"portal",completed_at:now,completed_by:user.id}).eq("id",file.current_action_id);
 const metadata:Record<string,unknown>={createdByOverride:true};if(option.actionCode==="check_proposal_status")metadata.follow_up_number=1;
 const{data:newAction,error:actionError}=await supabase.from("travel_actions").insert({
  travel_file_id:travelFileId,action_code:option.actionCode,title:option.title,action_role:option.actionCode==="waiting_for_travel"?"supporting":"blocking",
  responsible_type:option.responsibleType,responsible_user_id:option.responsibleType==="internal"?body.responsibleUserId:null,status:"active",
  waiting_since:option.responsibleType==="client"||option.responsibleType==="system"?now:null,activated_at:now,due_at:body.dueAt||null,metadata
 }).select("id").single();
 if(actionError||!newAction)return NextResponse.json({error:"Failed to create new action."},{status:500});
 const{error:fileUpdateError}=await supabase.from("travel_files").update({stage:option.stage,stage_changed_at:now,current_action_id:newAction.id}).eq("id",travelFileId);
 if(fileUpdateError){await supabase.from("travel_actions").delete().eq("id",newAction.id);return NextResponse.json({error:"Failed to update Travel File stage."},{status:500})}
 await supabase.from("travel_activity").insert({travel_file_id:travelFileId,event_type:"workflow_override",summary:`Workflow manually moved to ${option.title}.`,actor_type:"internal",actor_user_id:user.id,action_id:newAction.id,previous_stage:previousStage as never,new_stage:option.stage as never,metadata:{previousStage,newStage:option.stage,previousActionCode,newActionCode:option.actionCode,createdByOverride:true,responsible_user_id:body.responsibleUserId??null}});
 return NextResponse.json({success:true,stage:option.stage,actionId:newAction.id});
}