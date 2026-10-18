import {ensureProposalDepositPayment} from "@/lib/travel/proposal-deposit-payment";
import "server-only";
import {createServiceClient} from "@/lib/supabase/service";

export async function proposalWorkflowStatus(travelFileId:string){
 const db=createServiceClient();if(!db)throw new Error("Workflow service unavailable.");
 const [{data:file,error:fileError},{data:sessions,error:sessionsError},{data:party,error:partyError}]=await Promise.all([
  db.from("travel_files").select("id,stage,current_action_id,assigned_advisor_id").eq("id",travelFileId).single(),
  db.from("proposal_deposit_agreement_sessions").select("id,completed_at,created_at").eq("travel_file_id",travelFileId).order("created_at",{ascending:false}),
  db.from("travel_file_travellers").select("id,traveller_role,traveller_profiles:traveller_profile_id(first_name,last_name,preferred_name)").eq("travel_file_id",travelFileId)
 ]);
 if(fileError||sessionsError||partyError||!file)throw new Error("Could not verify proposal workflow.");
 const {data:action}=file.current_action_id?await db.from("travel_actions").select("id,action_code,status,metadata").eq("id",file.current_action_id).maybeSingle():{data:null};
 const {data:cycles,error:cycleError}=await db.from("travel_actions").select("activated_at,created_at").eq("travel_file_id",travelFileId).eq("action_code","proposal_acceptance_deposit_agreement").order("created_at",{ascending:false}).limit(1);
 if(cycleError)throw new Error("Could not verify current proposal cycle.");
 const cycleStart=cycles?.[0]?.activated_at??cycles?.[0]?.created_at;
 const ids=cycleStart?(sessions??[]).filter(x=>Date.parse(x.created_at)>=Date.parse(cycleStart)).map(x=>x.id):[];
 const [{data:acceptances,error:acceptError},{data:submissions,error:submitError}]=await Promise.all([
  ids.length?db.from("proposal_deposit_agreement_acceptances").select("session_id").in("session_id",ids):Promise.resolve({data:[],error:null}),
  ids.length?db.from("proposal_travel_information_submissions").select("session_id").in("session_id",ids):Promise.resolve({data:[],error:null})
 ]);
 if(acceptError||submitError)throw new Error("Could not verify proposal submissions.");
 const signed=new Set((acceptances??[]).map(x=>x.session_id)),submitted=new Set((submissions??[]).map(x=>x.session_id));
 const agreementComplete=ids.some(id=>signed.has(id));
 const preferencesComplete=ids.some(id=>signed.has(id)&&submitted.has(id));
 const primary=(party??[]).find(p=>p.traveller_role==="primary");
 const profile=primary?(Array.isArray(primary.traveller_profiles)?primary.traveller_profiles[0]:primary.traveller_profiles):null;
 const name=[profile?.preferred_name||profile?.first_name,profile?.last_name].filter(Boolean).join(" ")||"Primary traveller";
 return {db,file,action,agreementComplete,preferencesComplete,waitingItems:[
  {code:"proposal_agreement",label:"Proposal and Deposit Agreement — "+name,complete:agreementComplete},
  {code:"proposal_preferences",label:"Travel Preferences & Loyalty Information — "+name,complete:preferencesComplete}
 ]};
}

export async function advanceProposalWorkflow(travelFileId:string){
 const status=await proposalWorkflowStatus(travelFileId);
 const {db,file,action}=status;
 if(!action||action.action_code!=="await_proposal_acceptance"||action.status!=="active"||!status.agreementComplete||!status.preferencesComplete)return false;
 const {count,error:requirementsError}=await db.from("travel_action_requirements").select("id",{head:true,count:"exact"}).eq("travel_action_id",action.id).neq("status","complete");
 if(requirementsError||(count??0)>0)return false;
 const {data:cycle}=await db.from("travel_actions").select("activated_at,created_at").eq("travel_file_id",travelFileId).eq("action_code","proposal_acceptance_deposit_agreement").order("created_at",{ascending:false}).limit(1).maybeSingle();
 const since=cycle?.activated_at??cycle?.created_at;
 if(!since)throw new Error("Proposal cycle not found");
 const {data:acceptances,error:acceptError}=await db.from("proposal_deposit_agreement_acceptances").select("session_id,accepted_at").eq("travel_file_id",travelFileId).gte("accepted_at",since).order("accepted_at",{ascending:false}).limit(1);
 if(acceptError||!acceptances?.[0])throw new Error("Current proposal acceptance not found");
 const paymentId=await ensureProposalDepositPayment(travelFileId,acceptances[0].session_id);
 const now=new Date().toISOString();
 const {data:next,error:insertError}=await db.from("travel_actions").insert({
  travel_file_id:travelFileId,action_code:"collect_deposit",title:"Process Deposit",description:"Arrange and record the deposit manually in ClientBase and the Travel File. Do not mark paid until confirmed.",action_role:"blocking",responsible_type:"internal",responsible_user_id:file.assigned_advisor_id,status:"active",waiting_since:now,activated_at:now,
  metadata:{trigger:"proposal_agreement_and_preferences_completed",deposit_amount:(action.metadata as {deposit_amount?:number}|null)?.deposit_amount??null,deposit_payment_id:paymentId}
 }).select("id").single();
 if(insertError||!next)throw new Error("Could not create deposit processing action.");
 const {data:updated,error:updateError}=await db.from("travel_files").update({stage_changed_at:now,current_action_id:next.id}).eq("id",travelFileId).eq("current_action_id",action.id).select("id").maybeSingle();
 if(updateError||!updated){await db.from("travel_actions").delete().eq("id",next.id);return false}
 await db.from("travel_actions").update({status:"completed",completed_at:now,completion_source:"system",completion_event:"proposal_agreement_and_preferences_completed"}).eq("id",action.id);
 await db.from("travel_activity").insert({travel_file_id:travelFileId,event_type:"proposal_agreement_and_preferences_completed",summary:"Proposal agreement and travel preferences received. Deposit requires manual processing.",actor_type:"client",action_id:action.id,previous_stage:file.stage,new_stage:file.stage});
 return true;
}
