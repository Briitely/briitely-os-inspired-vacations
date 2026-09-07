import {NextResponse} from "next/server";
import {getAuthenticatedUser} from "@/lib/supabase/auth";
import {createClient} from "@/lib/supabase/server";

type Body={outcome?:"engaged"|"no_activity"};
function addDays(days:number){const d=new Date();d.setDate(d.getDate()+days);return d.toISOString()}

export async function POST(request:Request,{params}:{params:Promise<{travelFileId:string}>}){
 const{user}=await getAuthenticatedUser();if(!user||!user.isActive)return NextResponse.json({error:"Authentication required."},{status:401});if(!["staff","admin","super_admin"].includes(user.role))return NextResponse.json({error:"Staff access required."},{status:403});
 const{travelFileId}=await params;const body=(await request.json().catch(()=>({}))) as Body;const db=await createClient();
 const{data:file,error}=await db.from("travel_files").select("id,stage,current_action_id,assigned_advisor_id,current_action:travel_actions!current_action_id(id,action_code,status,metadata)").eq("id",travelFileId).maybeSingle();
 if(error||!file)return NextResponse.json({error:"Travel File not found."},{status:404});const current=Array.isArray(file.current_action)?file.current_action[0]:file.current_action;
 if(!current||current.action_code!=="check_proposal_status"||current.status!=="active")return NextResponse.json({error:"Check Proposal Status is not the active action."},{status:409});
 const now=new Date().toISOString();const followUp=Number((current.metadata as Record<string,unknown>|null)?.follow_up_number??1);
 if(body.outcome==="engaged"){
  const{data:next,error:nextError}=await db.from("travel_actions").insert({travel_file_id:travelFileId,action_code:"negotiate_proposal",title:"Negotiating",description:"Track client feedback and proposal revisions through acceptance or closure.",action_role:"blocking",responsible_type:"internal",responsible_user_id:file.assigned_advisor_id,status:"active",waiting_since:now,activated_at:now,metadata:{entered_from:"proposal_engagement",negotiating_started_at:now}}).select("id").single();if(nextError||!next)return NextResponse.json({error:"Could not start Negotiating."},{status:500});
  await db.from("travel_actions").update({status:"completed",completed_at:now,completed_by:user.id,completion_source:"portal",completion_event:"client_engaged"}).eq("id",current.id);
  const{error:updateError}=await db.from("travel_files").update({stage:"negotiating",stage_changed_at:now,current_action_id:next.id}).eq("id",travelFileId);if(updateError)return NextResponse.json({error:"Could not update the Travel File."},{status:500});
  await db.from("travel_activity").insert({travel_file_id:travelFileId,event_type:"proposal_engaged",summary:"Client viewed or responded to the proposal; moved to Negotiating.",actor_type:"internal",actor_user_id:user.id,action_id:current.id,previous_stage:file.stage,new_stage:"negotiating"});return NextResponse.json({success:true,stage:"negotiating"});
 }
 if(body.outcome==="no_activity"){
  const nextFollowUp=followUp+1;const dueDays=followUp===1?2:5;const title=followUp===1?"Check Proposal Status — Second Follow-up":"Review Opportunity Status";const description=followUp===1?"Send the first proposal reminder, then check again for a client view or response.":"No client activity after proposal follow-up. Review whether to mark the proposal inactive.";
  const{data:next,error:nextError}=await db.from("travel_actions").insert({travel_file_id:travelFileId,action_code:followUp===1?"check_proposal_status":"review_proposal_opportunity",title,description,action_role:"blocking",responsible_type:"internal",responsible_user_id:file.assigned_advisor_id,status:"active",due_at:addDays(dueDays),waiting_since:now,activated_at:now,metadata:{follow_up_number:nextFollowUp,reminder_required:true}}).select("id").single();if(nextError||!next)return NextResponse.json({error:"Could not create the next proposal follow-up."},{status:500});
  await db.from("travel_actions").update({status:"completed",completed_at:now,completed_by:user.id,completion_source:"portal",completion_event:"no_client_activity"}).eq("id",current.id);await db.from("travel_files").update({current_action_id:next.id}).eq("id",travelFileId);
  await db.from("travel_activity").insert({travel_file_id:travelFileId,event_type:"proposal_follow_up",summary:followUp===1?"No proposal activity; first reminder is due and another check is scheduled in 2 days.":"No proposal activity after follow-up; opportunity review scheduled.",actor_type:"internal",actor_user_id:user.id,action_id:current.id,metadata:{follow_up_number:nextFollowUp,due_at:addDays(dueDays)}});return NextResponse.json({success:true,nextAction:title});
 }
 return NextResponse.json({error:"Select the proposal status."},{status:400});
}
