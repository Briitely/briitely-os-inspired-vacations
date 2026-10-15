import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { getContact } from "@/lib/briitely/contacts";

type RelationshipType = "spouse_partner" | "child" | "adult_child" | "parent" | "other_family" | "household";
const VALID_RELATIONSHIPS = new Set<RelationshipType>(["spouse_partner","child","adult_child","parent","other_family"]);
const hasDnbTag=(tags?:string[])=>(tags??[]).some(tag=>tag.trim().toLowerCase()==="dnb");
function inverseRelationship(type:RelationshipType):RelationshipType{if(type==="child"||type==="adult_child")return"parent";if(type==="parent")return"child";return type}
async function requireUser(){const{user,error}=await getAuthenticatedUser();if(error||!user)return null;return user}
async function upsertContactTraveller(supabase:Awaited<ReturnType<typeof createClient>>,contactId:string){const contact=await getContact(contactId);const{data:existing}=await supabase.from("traveller_profiles").select("dnb_reason").eq("briitely_contact_id",contact.id).maybeSingle();const{data,error}=await supabase.from("traveller_profiles").upsert({briitely_contact_id:contact.id,first_name:contact.firstName||"Unknown",last_name:contact.lastName||"",email:contact.email||null,phone:contact.phone||null,is_dnb:hasDnbTag(contact.tags),dnb_reason:existing?.dnb_reason??null},{onConflict:"briitely_contact_id"}).select("id, briitely_contact_id, first_name, last_name, preferred_name, date_of_birth, email, phone, middle_name, passport_number, passport_country, passport_issue_date, passport_expiry_date, special_considerations, is_dnb, dnb_reason").single();if(error||!data)throw new Error(error?.message??"Could not save traveller profile.");return data}

export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){if(!(await requireUser()))return NextResponse.json({error:"Unauthorized"},{status:401});const{id}=await params;const supabase=await createClient();const{data,error}=await supabase.from("client_relationships").select(`id, relationship_type, related_traveller_id, traveller_profiles:related_traveller_id (id, briitely_contact_id, first_name, last_name, preferred_name, date_of_birth, email, phone, is_dnb, dnb_reason, is_deceased)`).eq("primary_contact_id",id).order("created_at",{ascending:true});if(error)return NextResponse.json({error:error.message},{status:500});return NextResponse.json({relationships:data??[]})}

export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){if(!(await requireUser()))return NextResponse.json({error:"Unauthorized"},{status:401});const{id}=await params;const body=await req.json().catch(()=>null) as {relationshipType?:RelationshipType;existingCustomerId?:string;firstName?:string;lastName?:string;preferredName?:string;dateOfBirth?:string;email?:string;phone?:string;middleName?:string;passportNumber?:string;passportCountry?:string;passportIssueDate?:string;passportExpiryDate?:string;specialConsiderations?:string}|null;if(!body?.relationshipType||!VALID_RELATIONSHIPS.has(body.relationshipType))return NextResponse.json({error:"Choose a valid relationship type."},{status:400});if(body.existingCustomerId===id)return NextResponse.json({error:"A customer cannot be related to themselves."},{status:400});const supabase=await createClient();try{let relatedTraveller;if(body.existingCustomerId)relatedTraveller=await upsertContactTraveller(supabase,body.existingCustomerId);else{const firstName=body.firstName?.trim(),lastName=body.lastName?.trim();if(!firstName||!lastName)return NextResponse.json({error:"First and last name are required."},{status:400});const{data,error}=await supabase.from("traveller_profiles").insert({first_name:firstName,last_name:lastName,preferred_name:body.preferredName?.trim()||null,date_of_birth:body.dateOfBirth||null,email:body.email?.trim()||null,phone:body.phone?.trim()||null,middle_name:body.middleName?.trim()||null,passport_number:body.passportNumber?.trim()||null,passport_country:body.passportCountry?.trim()||null,passport_issue_date:body.passportIssueDate||null,passport_expiry_date:body.passportExpiryDate||null,special_considerations:body.specialConsiderations?.trim()||null}).select("id, briitely_contact_id, first_name, last_name, preferred_name, date_of_birth, email, phone, is_dnb, dnb_reason").single();if(error||!data)throw new Error(error?.message??"Could not create traveller profile.");relatedTraveller=data}const{data:relationship,error:relationshipError}=await supabase.from("client_relationships").upsert({primary_contact_id:id,related_traveller_id:relatedTraveller.id,relationship_type:body.relationshipType},{onConflict:"primary_contact_id,related_traveller_id"}).select("id, relationship_type, related_traveller_id").single();if(relationshipError||!relationship)throw new Error(relationshipError?.message??"Could not create relationship.");if(relatedTraveller.briitely_contact_id){const primaryTraveller=await upsertContactTraveller(supabase,id);await supabase.from("client_relationships").upsert({primary_contact_id:relatedTraveller.briitely_contact_id,related_traveller_id:primaryTraveller.id,relationship_type:inverseRelationship(body.relationshipType)},{onConflict:"primary_contact_id,related_traveller_id"})}return NextResponse.json({relationship},{status:201})}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Could not create relationship."},{status:500})}}

export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){if(!(await requireUser()))return NextResponse.json({error:"Unauthorized"},{status:401});const{id}=await params;const body=await req.json().catch(()=>null) as {relationshipId?:string;firstName?:string;lastName?:string;preferredName?:string;dateOfBirth?:string;email?:string;phone?:string;relationshipType?:RelationshipType;middleName?:string;passportNumber?:string;passportCountry?:string;passportIssueDate?:string;passportExpiryDate?:string;specialConsiderations?:string}|null;if(!body?.relationshipId)return NextResponse.json({error:"Relationship ID is required."},{status:400});if(body.relationshipType&&!VALID_RELATIONSHIPS.has(body.relationshipType))return NextResponse.json({error:"Choose a valid relationship type."},{status:400});const supabase=await createClient();const{data:relationship,error:relationshipError}=await supabase.from("client_relationships").select("id, relationship_type, related_traveller_id, traveller_profiles:related_traveller_id(id,briitely_contact_id,first_name,last_name,preferred_name,date_of_birth,email,phone)").eq("id",body.relationshipId).eq("primary_contact_id",id).maybeSingle();if(relationshipError)return NextResponse.json({error:relationshipError.message},{status:500});if(!relationship)return NextResponse.json({error:"Relationship not found."},{status:404});const profile=Array.isArray(relationship.traveller_profiles)?relationship.traveller_profiles[0]:relationship.traveller_profiles;if(!profile)return NextResponse.json({error:"Traveller profile not found."},{status:404});const firstName=body.firstName?.trim()||profile.first_name,lastName=body.lastName?.trim()||profile.last_name;if(!firstName||!lastName)return NextResponse.json({error:"First and last name are required."},{status:400});const{error:updateError}=await supabase.from("traveller_profiles").update({first_name:firstName,last_name:lastName,preferred_name:body.preferredName?.trim()||null,date_of_birth:body.dateOfBirth||null,email:body.email?.trim()||null,phone:body.phone?.trim()||null,middle_name:body.middleName?.trim()||null,passport_number:body.passportNumber?.trim()||null,passport_country:body.passportCountry?.trim()||null,passport_issue_date:body.passportIssueDate||null,passport_expiry_date:body.passportExpiryDate||null,special_considerations:body.specialConsiderations?.trim()||null}).eq("id",profile.id);if(updateError)return NextResponse.json({error:updateError.message},{status:500});
if(body.relationshipType&&body.relationshipType!==relationship.relationship_type){
 const {error:relError}=await supabase.from("client_relationships").update({relationship_type:body.relationshipType}).eq("id",relationship.id).eq("primary_contact_id",id);
 if(relError)return NextResponse.json({error:relError.message},{status:500});
 if(profile.briitely_contact_id){
  const {data:primary}=await supabase.from("traveller_profiles").select("id,date_of_birth").eq("briitely_contact_id",id).maybeSingle();
  if(primary){
   let reciprocal:RelationshipType=body.relationshipType;
   if(body.relationshipType==="child"||body.relationshipType==="adult_child")reciprocal="parent";
   if(body.relationshipType==="parent"){
    const dob=primary.date_of_birth;
    if(dob){const [y,m,d]=dob.split("-").map(Number);const now=new Date();let age=now.getFullYear()-y;if(now.getMonth()+1<m||(now.getMonth()+1===m&&now.getDate()<d))age--;reciprocal=age<18?"child":"adult_child"}
    else reciprocal="adult_child";
   }
   const {error:reverseError}=await supabase.from("client_relationships").upsert({primary_contact_id:profile.briitely_contact_id,related_traveller_id:primary.id,relationship_type:reciprocal},{onConflict:"primary_contact_id,related_traveller_id"});
   if(reverseError)return NextResponse.json({error:"Relationship updated, but reciprocal relationship could not be updated: "+reverseError.message},{status:500});
  }
 }
}
return NextResponse.json({updated:true})}

export async function DELETE(req:Request,{params}:{params:Promise<{id:string}>}){
 const user=await requireUser();if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
 const {id}=await params;const url=new URL(req.url),relationshipId=url.searchParams.get("relationshipId");
 if(!relationshipId)return NextResponse.json({error:"Relationship ID required."},{status:400});
 const db=await createClient();
 const {data:rel,error}=await db.from("client_relationships").select("id,related_traveller_id,traveller_profiles:related_traveller_id(id,briitely_contact_id)").eq("id",relationshipId).eq("primary_contact_id",id).maybeSingle();
 if(error)return NextResponse.json({error:error.message},{status:500});
 if(!rel)return NextResponse.json({error:"Relationship not found."},{status:404});
 const profile=Array.isArray(rel.traveller_profiles)?rel.traveller_profiles[0]:rel.traveller_profiles;
 if(!profile)return NextResponse.json({error:"Traveller profile not found."},{status:404});
 if(!profile.briitely_contact_id){
   return NextResponse.json({error:"This traveller does not have a separate client file. Choose Create Separate Client File or Permanent Delete in the unlink dialog."},{status:409});
 }
 const {error:deleteError}=await db.from("client_relationships").delete().eq("id",relationshipId).eq("primary_contact_id",id);
 if(deleteError)return NextResponse.json({error:deleteError.message},{status:500});
 const {data:primary}=await db.from("traveller_profiles").select("id").eq("briitely_contact_id",id).maybeSingle();
 if(primary){
  const {error:reverseError}=await db.from("client_relationships").delete().eq("primary_contact_id",profile.briitely_contact_id).eq("related_traveller_id",primary.id);
  if(reverseError)return NextResponse.json({error:"Forward relationship removed, but reciprocal unlink failed: "+reverseError.message},{status:500});
 }
 return NextResponse.json({unlinked:true});
}
