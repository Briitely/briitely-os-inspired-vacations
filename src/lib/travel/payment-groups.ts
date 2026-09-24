export async function ensurePrimaryPaymentGroup(db:any,travelFileId:string){
 const{data:primary,error}=await db.from("travel_file_travellers").select("id,traveller_profiles:traveller_profile_id(email)").eq("travel_file_id",travelFileId).eq("traveller_role","primary").limit(1).maybeSingle();
 if(error||!primary)return null;
 const{data:links}=await db.from("travel_payment_group_travellers").select("payment_group_id,travel_payment_groups:payment_group_id(id,travel_file_id)").eq("travel_file_traveller_id",primary.id);
 const existing=(links??[]).map((l:any)=>Array.isArray(l.travel_payment_groups)?l.travel_payment_groups[0]:l.travel_payment_groups).find((g:any)=>g?.travel_file_id===travelFileId);
 if(existing?.id)return existing.id as string;
 const profile=Array.isArray(primary.traveller_profiles)?primary.traveller_profiles[0]:primary.traveller_profiles;
 const{data:group, error:groupError}=await db.from("travel_payment_groups").insert({travel_file_id:travelFileId,label:"Primary Traveller",payment_email_recipient_traveller_id:profile?.email?.trim()?primary.id:null}).select("id").single();
 if(groupError||!group)return null;
 const{error:linkError}=await db.from("travel_payment_group_travellers").insert({payment_group_id:group.id,travel_file_traveller_id:primary.id});
 if(linkError){await db.from("travel_payment_groups").delete().eq("id",group.id);return null}
 return group.id as string;
}
export async function assignUnassignedPaymentsToPrimaryGroup(db:any,travelFileId:string){
 const groupId=await ensurePrimaryPaymentGroup(db,travelFileId);if(!groupId)return null;
 await db.from("travel_payments").update({payment_group_id:groupId}).eq("travel_file_id",travelFileId).is("payment_group_id",null);
 return groupId;
}