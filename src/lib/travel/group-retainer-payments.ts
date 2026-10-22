import { createServiceClient } from "@/lib/supabase/service";

/** When Collect Retainer Payment was entered by Override/Reopen with the agreement confirmed outside the dashboard. */
export function externalRetainerConfirmedAt(metadata:unknown):string|null{const value=(metadata as {retainer_agreement_confirmed_externally?:{confirmed_at?:unknown}}|null)?.retainer_agreement_confirmed_externally?.confirmed_at;return typeof value==="string"?value:null}

// confirmedExternallyAt: groups without an online signature are treated as signed at
// that time for their configured retainer amount (agreement confirmed outside the dashboard).
export async function reconcileGroupRetainerPayments(travelFileId:string,opts:{confirmedExternallyAt?:string|null}={}){
 const db=createServiceClient();if(!db)throw new Error("Retainer payment service unavailable.");
 // A finalized source file retains historical signatures, but its retainer
 // payments may belong to linked files. Never recreate those payments here.
 const {count:splitCount,error:splitError}=await db.from("travel_file_group_splits")
   .select("id",{count:"exact",head:true}).eq("source_travel_file_id",travelFileId);
 if(splitError)throw new Error(splitError.message);
 if((splitCount??0)>0)return;
 const [{data:terms,error:te},{data:acceptances,error:ae},{data:party,error:pe},{data:links,error:le}]=await Promise.all([
 db.from("travel_group_retainers").select("recipient_party_member_id,retainer_amount").eq("travel_file_id",travelFileId),
 db.from("travel_group_retainer_acceptances").select("recipient_party_member_id,retainer_amount,accepted_at").eq("travel_file_id",travelFileId),
 db.from("travel_file_travellers").select("id,traveller_role,booking_form_recipient_party_member_id,traveller_profiles:traveller_profile_id(first_name,last_name)").eq("travel_file_id",travelFileId),
 db.from("travel_group_retainer_payments").select("recipient_party_member_id,payment_id").eq("travel_file_id",travelFileId)
 ]);
 if(te||ae||pe||le)throw new Error((te||ae||pe||le)?.message??"Could not read group retainer records.");
 const signed=new Map<string,{amount:number;at:string}>();for(const a of acceptances??[]){if(!a.accepted_at)continue;const old=signed.get(a.recipient_party_member_id);if(!old||a.accepted_at>old.at)signed.set(a.recipient_party_member_id,{amount:Number(a.retainer_amount),at:a.accepted_at})}
 const existing=new Map((links??[]).map(l=>[l.recipient_party_member_id,l.payment_id]));
 const people=party??[];const names=(id:string)=>{const m=people.find(p=>p.id===id);const p=Array.isArray(m?.traveller_profiles)?m.traveller_profiles[0]:m?.traveller_profiles;return[p?.first_name,p?.last_name].filter(Boolean).join(" ")||"Traveller"};
 for(const t of terms??[]){const id=t.recipient_party_member_id,external=!signed.has(id)&&opts.confirmedExternallyAt&&t.retainer_amount!=null?{amount:Number(t.retainer_amount),at:opts.confirmedExternallyAt}:null,signature=signed.get(id)??external;if(!signature||existing.has(id))continue;
 const {data:payment,error:paymentError}=await db.from("travel_payments").insert({travel_file_id:travelFileId,payment_type:"other",description:"Retainer — "+names(id),amount:signature.amount,currency:"CAD",due_date:signature.at.slice(0,10),status:"upcoming",details:JSON.stringify({source:external?"externally_confirmed_group_retainer":"signed_group_retainer",recipientPartyMemberId:id})}).select("id").single();
 if(paymentError||!payment)throw new Error(paymentError?.message??"Could not create group retainer payment.");
 const {error:linkError}=await db.from("travel_group_retainer_payments").insert({travel_file_id:travelFileId,recipient_party_member_id:id,payment_id:payment.id});
 if(linkError){await db.from("travel_payments").delete().eq("id",payment.id);if(linkError.code!=="23505")throw new Error(linkError.message)}
 }
}
