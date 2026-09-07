import {NextResponse} from "next/server";
import {getAuthenticatedUser} from "@/lib/supabase/auth";
import {createClient} from "@/lib/supabase/server";
import {getContact} from "@/lib/briitely/contacts";

type Body={action?:"prepare"|"mark-sent";travefyProposalUrl?:string;sentViaTravefy?:boolean};
function validUrl(value:string){try{const u=new URL(value);return u.protocol==="http:"||u.protocol==="https:"}catch{return false}}
function addDays(days:number){const d=new Date();d.setDate(d.getDate()+days);return d.toISOString()}

export async function GET(_request:Request,{params}:{params:Promise<{travelFileId:string}>}){
 const{user}=await getAuthenticatedUser();if(!user||!user.isActive)return NextResponse.json({error:"Authentication required."},{status:401});
 const{travelFileId}=await params;const db=await createClient();
 const{data:file,error}=await db.from("travel_files").select("id,client_name,briitely_contact_id,travefy_proposal_url,assigned_advisor:profiles!assigned_advisor_id(full_name)").eq("id",travelFileId).maybeSingle();
 if(error||!file)return NextResponse.json({error:"Travel File not found."},{status:404});
 let email="",firstName=file.client_name?.split(/\s+/)[0]||"there";
 if(file.briitely_contact_id){try{const c=await getContact(file.briitely_contact_id);email=c.email||"";firstName=c.firstName||firstName}catch{}}
 const advisor=Array.isArray(file.assigned_advisor)?file.assigned_advisor[0]:file.assigned_advisor;
 return NextResponse.json({clientName:file.client_name,firstName,email,assignedAdvisorName:advisor?.full_name??"Your Inspired Vacations Advisor",travefyProposalUrl:file.travefy_proposal_url??""});
}

export async function POST(request:Request,{params}:{params:Promise<{travelFileId:string}>}){
 const{user}=await getAuthenticatedUser();if(!user||!user.isActive)return NextResponse.json({error:"Authentication required."},{status:401});if(!["staff","admin","super_admin"].includes(user.role))return NextResponse.json({error:"Staff access required."},{status:403});
 const{travelFileId}=await params;const body=(await request.json().catch(()=>({}))) as Body;const db=await createClient();
 const{data:file,error:fileError}=await db.from("travel_files").select("id,stage,current_action_id,assigned_advisor_id,travefy_proposal_url,current_action:travel_actions!current_action_id(id,action_code,status)").eq("id",travelFileId).maybeSingle();
 if(fileError||!file)return NextResponse.json({error:"Travel File not found."},{status:404});const current=Array.isArray(file.current_action)?file.current_action[0]:file.current_action;
 if(!current||current.action_code!=="create_proposal"||current.status!=="active")return NextResponse.json({error:"Create Proposal is not the active action for this Travel File."},{status:409});
 if(body.action==="prepare"){
  if(!body.sentViaTravefy)return NextResponse.json({error:"Confirm that you have sent the proposal via Travefy."},{status:400});
  const url=(body.travefyProposalUrl??"").trim();if(!url)return NextResponse.json({error:"Travefy Proposal URL is required."},{status:400});if(!validUrl(url))return NextResponse.json({error:"Enter a valid Travefy Proposal URL."},{status:400});
  const{error:updateError}=await db.from("travel_files").update({travefy_proposal_url:url}).eq("id",travelFileId);if(updateError)return NextResponse.json({error:"Could not save the Travefy Proposal URL."},{status:500});
  await db.from("travel_activity").insert({travel_file_id:travelFileId,event_type:"proposal_prepared",summary:"Proposal sent through Travefy and client email prepared.",actor_type:"internal",actor_user_id:user.id,action_id:current.id,metadata:{travefy_proposal_url:url}});
  return NextResponse.json({success:true,travefyProposalUrl:url});
 }
 if(body.action==="mark-sent"){
  if(!file.travefy_proposal_url)return NextResponse.json({error:"Travefy Proposal URL is required before marking the proposal email sent."},{status:400});const now=new Date().toISOString();
  const{data:nextAction,error:actionError}=await db.from("travel_actions").insert({travel_file_id:travelFileId,action_code:"check_proposal_status",title:"Check Proposal Status",description:"Check whether the client has viewed the proposal or responded with acceptance or revision requests.",action_role:"blocking",responsible_type:"internal",responsible_user_id:file.assigned_advisor_id,status:"active",due_at:addDays(3),waiting_since:now,activated_at:now,metadata:{follow_up_number:1,proposal_sent_at:now}}).select("id").single();
  if(actionError||!nextAction)return NextResponse.json({error:"Could not create the proposal follow-up action."},{status:500});
  const{data:updated,error:updateError}=await db.from("travel_files").update({stage:"proposal_sent",stage_changed_at:now,current_action_id:nextAction.id}).eq("id",travelFileId).eq("current_action_id",current.id).select("id").maybeSingle();
  if(updateError||!updated)return NextResponse.json({error:"Could not advance the Travel File."},{status:500});
  await db.from("travel_actions").update({status:"completed",completed_at:now,completed_by:user.id,completion_source:"portal",completion_event:"proposal_email_sent"}).eq("id",current.id);
  await db.from("travel_activity").insert({travel_file_id:travelFileId,event_type:"proposal_sent",summary:"Proposal email marked sent; first proposal status check due in 3 days.",actor_type:"internal",actor_user_id:user.id,action_id:current.id,previous_stage:file.stage,new_stage:"proposal_sent",metadata:{follow_up_due_at:addDays(3)}});
  return NextResponse.json({success:true,stage:"proposal_sent",currentActionId:nextAction.id});
 }
 return NextResponse.json({error:"Invalid action."},{status:400});
}
