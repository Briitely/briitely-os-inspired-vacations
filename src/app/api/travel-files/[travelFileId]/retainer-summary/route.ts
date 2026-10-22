import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { externalRetainerConfirmedAt, reconcileGroupRetainerPayments } from "@/lib/travel/group-retainer-payments";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ travelFileId: string }> }
) {
  const { user } = await getAuthenticatedUser();
  if (!user || !user.isActive) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!["staff", "admin", "super_admin"].includes(user.role)) {
    return NextResponse.json({ error: "Staff access required." }, { status: 403 });
  }

  const { travelFileId } = await params;
  const db = await createClient();
  const { data: file, error } = await db
    .from("travel_files")
    .select("id,tmf_amount,current_action:travel_actions!current_action_id(id,action_code,status,metadata)")
    .eq("id", travelFileId)
    .maybeSingle();

  if (error || !file) {
    return NextResponse.json({ error: "Travel File not found." }, { status: 404 });
  }

  const current = Array.isArray(file.current_action) ? file.current_action[0] : file.current_action;
  if (!current || current.action_code !== "collect_tmf_payment" || current.status !== "active") {
    return NextResponse.json({ error: "Collect Retainer Payment is not the active action." }, { status: 409 });
  }

  const service=createServiceClient();if(!service)return NextResponse.json({error:"Retainer service unavailable."},{status:500});
  const {data:terms,error:termsError}=await service.from("travel_group_retainers").select("recipient_party_member_id,retainer_amount").eq("travel_file_id",travelFileId);
  if(termsError)return NextResponse.json({error:termsError.message},{status:500});
  if(terms?.length){
    try{await reconcileGroupRetainerPayments(travelFileId,{confirmedExternallyAt:externalRetainerConfirmedAt(current.metadata)})}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Could not reconcile retainer payments."},{status:500})}
    const [{data:links,error:linksError},{data:party,error:partyError}]=await Promise.all([service.from("travel_group_retainer_payments").select("recipient_party_member_id,payment_id").eq("travel_file_id",travelFileId),service.from("travel_file_travellers").select("id,traveller_profiles:traveller_profile_id(first_name,last_name)").eq("travel_file_id",travelFileId)]);
    if(linksError||partyError)return NextResponse.json({error:(linksError||partyError)?.message},{status:500});
    const paymentIds=(links??[]).map(l=>l.payment_id);
    const {data:payments,error:paymentsError}=paymentIds.length?await service.from("travel_payments").select("id,amount,status,processed_at").in("id",paymentIds):{data:[],error:null};
    if(paymentsError)return NextResponse.json({error:paymentsError.message},{status:500});
    const groups=(terms??[]).map(t=>{const link=(links??[]).find(l=>l.recipient_party_member_id===t.recipient_party_member_id);const payment=(payments??[]).find(p=>p.id===link?.payment_id);const member=(party??[]).find(p=>p.id===t.recipient_party_member_id);const profile=Array.isArray(member?.traveller_profiles)?member.traveller_profiles[0]:member?.traveller_profiles;return{recipientId:t.recipient_party_member_id,name:[profile?.first_name,profile?.last_name].filter(Boolean).join(" ")||"Traveller",amount:Number(payment?.amount??t.retainer_amount),paid:payment?.status==="paid",paymentId:payment?.id??null,processedAt:payment?.processed_at??null}});
    return NextResponse.json({amount:groups.reduce((total,g)=>total+g.amount,0),groups});
  }
  return NextResponse.json({ amount: Number(file.tmf_amount ?? 0),groups:[] });
}
