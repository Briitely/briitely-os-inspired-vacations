import "server-only";
import {createServiceClient} from "@/lib/supabase/service";
import {ensurePrimaryPaymentGroup} from "@/lib/travel/payment-groups";

/** Create a pending payment instruction, never a card charge or paid receipt. */
export async function ensureProposalDepositPayment(travelFileId:string,sessionId:string){
 const db=createServiceClient();if(!db)throw new Error("Payment service unavailable");
 const {data:acceptance,error:acceptanceError}=await db.from("proposal_deposit_agreement_acceptances")
  .select("id,deposit_amount,payment_choice,saved_card_brand,saved_card_last_four")
  .eq("travel_file_id",travelFileId).eq("session_id",sessionId).maybeSingle();
 if(acceptanceError||!acceptance)throw new Error("Signed agreement missing");
 const ref="proposal-deposit:"+acceptance.id;
 const {data:existing,error:existingError}=await db.from("travel_payments").select("id,status").eq("travel_file_id",travelFileId).eq("external_reference",ref).maybeSingle();
 if(existingError)throw new Error("Could not verify existing deposit payment");
 if(existing)return existing.id as string;
 const groupId=await ensurePrimaryPaymentGroup(db,travelFileId);
 if(!groupId)throw new Error("Primary payment group unavailable");
 const choice=acceptance.payment_choice as string;
 const cardLastFour=choice==="saved_card"?acceptance.saved_card_last_four:null;
 const cardBrand=choice==="saved_card"?acceptance.saved_card_brand:null;
 const instruction=choice==="saved_card"?`Authorized card: ${cardBrand??"Card"} ending ${cardLastFour??"unknown"}`:choice==="different_card"?"Client requested a different card. Advisor must follow up securely.":"No card on file. Advisor must arrange payment securely.";
 const today=new Date().toISOString().slice(0,10);
 const {data:payment,error}=await db.from("travel_payments").insert({
  travel_file_id:travelFileId,payment_group_id:groupId,payment_type:"deposit",
  description:choice==="saved_card"?"Proposal Deposit — Card Authorized":"Proposal Deposit — Payment Follow-up Required",amount:Number(acceptance.deposit_amount),
  commission_amount:0,currency:"CAD",due_date:today,
  client_notification_date:today,status:"upcoming",external_reference:ref,
  details:JSON.stringify({supplier:null,cardLastFour,processingMethod:"manual",paymentChoice:choice,cardBrand,proposalAcceptanceId:acceptance.id})
 }).select("id").single();
 if(error||!payment)throw new Error(error?.message??"Could not create deposit payment");
 return payment.id as string;
}
