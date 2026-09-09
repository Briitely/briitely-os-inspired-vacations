import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { addContactTag, getContact, removeContactTag } from "@/lib/briitely/contacts";

const PROFILE_FIELDS = "id, briitely_contact_id, first_name, middle_name, last_name, preferred_name, date_of_birth, email, phone, passport_number, passport_country, passport_issue_date, passport_expiry_date, emergency_contact_name, emergency_contact_relationship, emergency_contact_phone, emergency_contact_email, is_dnb, dnb_reason";
async function requireUser(){const{user,error}=await getAuthenticatedUser();return error||!user?null:user}
function hasDnbTag(tags?:string[]){return(tags??[]).some(tag=>tag.trim().toLowerCase()==="dnb")}

export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
 if(!(await requireUser()))return NextResponse.json({error:"Unauthorized"},{status:401});
 const{id}=await params;const supabase=await createClient();
 try{
  const contact=await getContact(id);const briitelyIsDnb=hasDnbTag(contact.tags);
  const{data:existing,error}=await supabase.from("traveller_profiles").select(PROFILE_FIELDS).eq("briitely_contact_id",id).maybeSingle();if(error)throw new Error(error.message);
  if(existing){
   if(Boolean(existing.is_dnb)!==briitelyIsDnb){const{data:updated,error:updateError}=await supabase.from("traveller_profiles").update({is_dnb:briitelyIsDnb}).eq("id",existing.id).select(PROFILE_FIELDS).single();if(updateError||!updated)throw new Error(updateError?.message??"Could not sync DNB status.");return NextResponse.json({profile:updated});}
   return NextResponse.json({profile:existing});
  }
  const{data,error:insertError}=await supabase.from("traveller_profiles").insert({briitely_contact_id:contact.id,first_name:contact.firstName||"Unknown",last_name:contact.lastName||"",email:contact.email||null,phone:contact.phone||null,is_dnb:briitelyIsDnb}).select(PROFILE_FIELDS).single();if(insertError||!data)throw new Error(insertError?.message??"Could not create traveller profile.");return NextResponse.json({profile:data});
 }catch(err){return NextResponse.json({error:err instanceof Error?err.message:"Could not load traveller profile."},{status:500})}
}

export async function PUT(req:Request,{params}:{params:Promise<{id:string}>}){
 if(!(await requireUser()))return NextResponse.json({error:"Unauthorized"},{status:401});const{id}=await params;const body=await req.json().catch(()=>null)as Record<string,unknown>|null;if(!body)return NextResponse.json({error:"Invalid request."},{status:400});const text=(key:string)=>typeof body[key]==="string"&&body[key]?String(body[key]).trim():null;const supabase=await createClient();
 try{const contact=await getContact(id);const briitelyIsDnb=hasDnbTag(contact.tags);const{data:existing}=await supabase.from("traveller_profiles").select("dnb_reason").eq("briitely_contact_id",id).maybeSingle();const{data,error}=await supabase.from("traveller_profiles").upsert({briitely_contact_id:id,first_name:text("firstName")||contact.firstName||"Unknown",middle_name:text("middleName"),last_name:text("lastName")||contact.lastName||"",preferred_name:text("preferredName"),date_of_birth:text("dateOfBirth"),email:contact.email||text("email"),phone:contact.phone||text("phone"),passport_number:text("passportNumber"),passport_country:text("passportCountry"),passport_issue_date:text("passportIssueDate"),passport_expiry_date:text("passportExpiryDate"),emergency_contact_name:text("emergencyContactName"),emergency_contact_relationship:text("emergencyContactRelationship"),emergency_contact_phone:text("emergencyContactPhone"),emergency_contact_email:text("emergencyContactEmail"),is_dnb:briitelyIsDnb,dnb_reason:existing?.dnb_reason??null},{onConflict:"briitely_contact_id"}).select(PROFILE_FIELDS).single();if(error||!data)throw new Error(error?.message??"Could not save traveller details.");return NextResponse.json({profile:data})}catch(err){return NextResponse.json({error:err instanceof Error?err.message:"Could not save traveller details."},{status:500})}
}

export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 const user=await requireUser();if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});const{id}=await params;const body=await req.json().catch(()=>null)as{action?:string;confirmation?:string;reason?:string}|null;const supabase=await createClient();
 if(body?.action==="remove_dnb"){
  if(body.confirmation!=="REMOVE DNB")return NextResponse.json({error:"Confirmation does not match."},{status:400});
  const tagResult=await removeContactTag(id,"dnb");if(!tagResult.succeeded)return NextResponse.json({error:"Could not remove the DNB tag from Briitely. The client has not been changed."},{status:502});
  const contact=await getContact(id);if(hasDnbTag(contact.tags))return NextResponse.json({error:"Briitely still reports this contact as DNB. The portal has not been changed."},{status:502});
  const{data,error}=await supabase.from("traveller_profiles").update({is_dnb:false}).eq("briitely_contact_id",id).select(PROFILE_FIELDS).single();if(error||!data)return NextResponse.json({error:error?.message??"Could not update DNB status."},{status:500});return NextResponse.json({ok:true,profile:data});
 }
 if(body?.action==="add_dnb"){
  const reason=body.reason?.trim()||null;const tagResult=await addContactTag(id,"dnb");if(!tagResult.succeeded)return NextResponse.json({error:"Could not add the DNB tag in Briitely. The client has not been changed."},{status:502});
  const contact=await getContact(id);if(!hasDnbTag(contact.tags))return NextResponse.json({error:"Briitely did not confirm the DNB tag. The portal has not been changed."},{status:502});
  const{data:existing}=await supabase.from("traveller_profiles").select("id").eq("briitely_contact_id",id).maybeSingle();let result;if(existing){result=await supabase.from("traveller_profiles").update({is_dnb:true,dnb_reason:reason}).eq("id",existing.id).select(PROFILE_FIELDS).single()}else{result=await supabase.from("traveller_profiles").insert({briitely_contact_id:id,first_name:contact.firstName||"Unknown",last_name:contact.lastName||"",email:contact.email||null,phone:contact.phone||null,is_dnb:true,dnb_reason:reason}).select(PROFILE_FIELDS).single()}if(result.error||!result.data)return NextResponse.json({error:result.error?.message??"Could not update DNB status."},{status:500});return NextResponse.json({ok:true,profile:result.data});
 }
 return NextResponse.json({error:"Unsupported action."},{status:400});
}
