import {ensureProposalDepositPayment} from "@/lib/travel/proposal-deposit-payment";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import {createServiceClient} from "@/lib/supabase/service";

function paymentInstruction(details:unknown){let data:Record<string,unknown>={};try{data=typeof details==="string"?JSON.parse(details):details&&typeof details==="object"?details as Record<string,unknown>:{};}catch{}const choice=data.paymentChoice;const lastFour=typeof data.cardLastFour==="string"&&/^\\d{4}$/.test(data.cardLastFour)?data.cardLastFour:null;const brand=typeof data.cardBrand==="string"?data.cardBrand:null;if(choice==="saved_card")return lastFour?`Per signed agreement — ${brand?brand+" ":""}card ending ${lastFour}`:"Per signed agreement — verify authorized card with client";if(choice==="different_card")return "Client requested a different card — follow up securely before processing.";if(choice==="no_card"||choice==="no_card_on_file")return "No card on file — follow up with client to arrange payment securely.";return lastFour?`Per signed agreement — card ending ${lastFour}`:"Check signed agreement and confirm payment card with client before processing.";}

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
  const { data: file, error: fileError } = await db
    .from("travel_files")
    .select("id,current_action_id,current_action:travel_actions!current_action_id(id,action_code,status,metadata)")
    .eq("id", travelFileId)
    .maybeSingle();

  if (fileError || !file) {
    return NextResponse.json({ error: "Travel File not found." }, { status: 404 });
  }

  const current = Array.isArray(file.current_action) ? file.current_action[0] : file.current_action;
  if (!current || current.action_code !== "collect_deposit" || current.status !== "active") {
    return NextResponse.json({ error: "Collect Deposit is not the active action." }, { status: 409 });
  }

  const metadata = (current.metadata ?? {}) as Record<string, unknown>;
  const paymentId = typeof metadata.deposit_payment_id === "string" ? metadata.deposit_payment_id : null;

  let paymentLookup = db
    .from("travel_payments")
    .select("id,amount,status,due_date,processed_at,details")
    .eq("travel_file_id", travelFileId)
    .eq("payment_type", "deposit");

  if (paymentId) {
    paymentLookup = paymentLookup.eq("id", paymentId);
  } else {
    paymentLookup = paymentLookup
      .in("status", ["processing", "paid"])
      .order("created_at", { ascending: false })
      .limit(1);
  }

  const { data: payment, error: paymentError } = await paymentLookup.maybeSingle();
  if (paymentError) return NextResponse.json({error:"Could not load deposit payment."},{status:500});
  if (!payment) {
    const service=createServiceClient();
    if(!service)return NextResponse.json({error:"Deposit service unavailable."},{status:500});
    const {data:cycle}=await service.from("travel_actions").select("activated_at,created_at").eq("travel_file_id",travelFileId).eq("action_code","proposal_acceptance_deposit_agreement").order("created_at",{ascending:false}).limit(1).maybeSingle();
    const since=cycle?.activated_at??cycle?.created_at;
    const {data:accepted}=since?await service.from("proposal_deposit_agreement_acceptances").select("session_id").eq("travel_file_id",travelFileId).gte("accepted_at",since).order("accepted_at",{ascending:false}).limit(1).maybeSingle():{data:null};
    if(!accepted)return NextResponse.json({error:"No signed proposal deposit was found for this Travel File."},{status:404});
    try{
      const createdId=await ensureProposalDepositPayment(travelFileId,accepted.session_id);
      const {data:created,error:createdError}=await service.from("travel_payments").select("id,amount,status,due_date,processed_at").eq("id",createdId).single();
      if(createdError||!created)return NextResponse.json({error:"Deposit created but could not be loaded."},{status:500});
      await service.from("travel_actions").update({metadata:{...metadata,deposit_payment_id:createdId}}).eq("id",current.id);
      return NextResponse.json({paymentId:created.id,amount:Number(created.amount??0),status:created.status,dueDate:created.due_date,processedAt:created.processed_at,paymentInstruction:paymentInstruction(created.details)});
    }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Could not prepare deposit payment."},{status:500})}
  }

  return NextResponse.json({
    paymentId: payment.id,
    amount: Number(payment.amount ?? 0),
    status: payment.status,
    dueDate: payment.due_date,
    processedAt: payment.processed_at,
    paymentInstruction: paymentInstruction(payment.details),
  });
}
