import {NextResponse} from "next/server";
import {getAuthenticatedUser} from "@/lib/supabase/auth";
import {createServiceClient} from "@/lib/supabase/service";

/**
 * Read-only preflight for splitting a negotiated Travel File.
 * Deliberately does not create files, move travellers, or mark payments paid.
 */
export async function GET(_request:Request,{params}:{params:Promise<{travelFileId:string}>}){
  const {user}=await getAuthenticatedUser();
  if(!user?.isActive)return NextResponse.json({error:"Authentication required."},{status:401});
  if(!["staff","admin","super_admin"].includes(user.role))return NextResponse.json({error:"Staff access required."},{status:403});
  const {travelFileId}=await params;
  const db=createServiceClient();
  if(!db)return NextResponse.json({error:"Split service unavailable."},{status:503});
  const [fileResult,partyResult,decisionResult,splitResult,signatureResult,retainerLinkResult,paymentResult]=await Promise.all([
    db.from("travel_files").select("id,client_name,current_action_id,current_action:travel_actions!current_action_id(action_code,status)").eq("id",travelFileId).maybeSingle(),
    db.from("travel_file_travellers").select("id,traveller_role,booking_form_recipient_party_member_id,traveller_profiles:traveller_profile_id(first_name,last_name)").eq("travel_file_id",travelFileId),
    db.from("travel_group_negotiations").select("recipient_party_member_id,decision,deposit_amount").eq("travel_file_id",travelFileId),
    db.from("travel_file_group_splits").select("recipient_party_member_id,resulting_travel_file_id").eq("source_travel_file_id",travelFileId),
    db.from("travel_group_retainer_acceptances").select("recipient_party_member_id,accepted_at,accepted_name,agreement_version,retainer_amount").eq("travel_file_id",travelFileId),
    db.from("travel_group_retainer_payments").select("recipient_party_member_id,payment_id").eq("travel_file_id",travelFileId),
    db.from("travel_payments").select("id,amount,status").eq("travel_file_id",travelFileId)
  ]);
  const error=fileResult.error??partyResult.error??decisionResult.error??splitResult.error??signatureResult.error??retainerLinkResult.error??paymentResult.error;
  if(error)return NextResponse.json({error:error.message},{status:500});
  const file=fileResult.data;
  if(!file)return NextResponse.json({error:"Travel File not found."},{status:404});
  const action=Array.isArray(file.current_action)?file.current_action[0]:file.current_action;
  const party=partyResult.data??[];
  const primary=party.find(p=>p.traveller_role==="primary");
  const ids=[primary?.id,...new Set(party.map(p=>p.booking_form_recipient_party_member_id).filter(Boolean))].filter(Boolean) as string[];
  const issues:string[]=[];
  if(action?.action_code!=="negotiate_proposal"||action?.status!=="active")issues.push("Negotiating must be the active action.");
  if(!primary)issues.push("Primary traveller is missing.");
  if(!ids.length)issues.push("No Travel Groups found.");
  const groups=ids.map(id=>{
    const member=party.find(p=>p.id===id);
    const profile=Array.isArray(member?.traveller_profiles)?member?.traveller_profiles[0]:member?.traveller_profiles;
    const name=[profile?.first_name,profile?.last_name].filter(Boolean).join(" ")||"Traveller";
    const decision=decisionResult.data?.find(d=>d.recipient_party_member_id===id);
    const members=party.filter(p=>p.id===id||(id===primary?.id?!p.booking_form_recipient_party_member_id:p.booking_form_recipient_party_member_id===id));
    const split=splitResult.data?.find(s=>s.recipient_party_member_id===id);
    const signed=(signatureResult.data??[]).filter(s=>s.recipient_party_member_id===id).sort((a,b)=>b.accepted_at.localeCompare(a.accepted_at))[0];
    const paymentLink=retainerLinkResult.data?.find(l=>l.recipient_party_member_id===id);
    const payment=paymentResult.data?.find(p=>p.id===paymentLink?.payment_id);
    if(decision?.decision==="accepted"&&!signed?.accepted_at)issues.push(name+": signed retainer acceptance is missing.");
    if(decision?.decision==="accepted"&&!payment)issues.push(name+": linked retainer payment record is missing.");
    if(!decision||decision.decision==="negotiating")issues.push(name+": negotiation decision is outstanding.");
    if(decision?.decision==="accepted"&&!(Number(decision.deposit_amount)>0))issues.push(name+": deposit amount is required.");
    if(!members.length)issues.push(name+": no travellers assigned.");
    return {recipientId:id,name,travellerCount:members.length,decision:decision?.decision??"negotiating",depositAmount:decision?.deposit_amount??null,resultingTravelFileId:split?.resulting_travel_file_id??null,retainerSignedAt:signed?.accepted_at??null,retainerSignedBy:signed?.accepted_name??null,retainerAmount:signed?.retainer_amount??null,retainerPaymentId:payment?.id??null,retainerPaymentStatus:payment?.status??null,retainerPaymentAmount:payment?.amount??null};
  });
  const assigned=new Set(groups.flatMap(g=>party.filter(p=>p.id===g.recipientId||(g.recipientId===primary?.id?!p.booking_form_recipient_party_member_id:p.booking_form_recipient_party_member_id===g.recipientId)).map(p=>p.id)));
  if(assigned.size!==party.length)issues.push("Some travellers are not assigned to a valid Travel Group.");
  if(splitResult.data?.length)issues.push("This Travel File already has split records; review them before retrying.");
  return NextResponse.json({ready:issues.length===0,issues,groups,sourceTravelFileId:travelFileId,createsFiles:groups.filter(g=>g.decision==="accepted"&&g.recipientId!==primary?.id).length});
}

/**
 * Transaction-locked validation before any write-capable split operation.
 * The database function currently validates only; it never creates files.
 */
export async function POST(_request:Request,{params}:{params:Promise<{travelFileId:string}>}){
  const {user}=await getAuthenticatedUser();
  if(!user?.isActive)return NextResponse.json({error:"Authentication required."},{status:401});
  if(!["staff","admin","super_admin"].includes(user.role))return NextResponse.json({error:"Staff access required."},{status:403});
  const {travelFileId}=await params;
  const db=createServiceClient();
  if(!db)return NextResponse.json({error:"Split service unavailable."},{status:503});
  const {data,error}=await db.rpc("prepare_negotiated_travel_file_split",{p_source_id:travelFileId});
  if(error)return NextResponse.json({error:error.message},{status:409});
  return NextResponse.json({success:true,validation:data,createdFiles:0,finalized:false,message:"Transaction validation passed. No Travel Files have been created."});
}
