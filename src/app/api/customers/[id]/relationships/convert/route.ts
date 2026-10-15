import {NextResponse} from "next/server";
import {getAuthenticatedUser} from "@/lib/supabase/auth";
import {createClient} from "@/lib/supabase/server";
import {getContact,findContactByEmailOrPhone,upsertContact} from "@/lib/briitely/contacts";
import {validatePhone} from "@/lib/briitely/query";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 const {user}=await getAuthenticatedUser();
 if(!user||!user.isActive||!["staff","admin","super_admin"].includes(user.role))return NextResponse.json({error:"Staff access required."},{status:403});
 const {id}=await params;
 const body=await request.json().catch(()=>null) as {relationshipId?:string;email?:string;phone?:string;useSameAddress?:boolean}|null;
 if(!body?.relationshipId)return NextResponse.json({error:"Relationship required."},{status:400});
 const email=body.email?.trim().toLowerCase()||"",phone=body.phone?.trim()||"";
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return NextResponse.json({error:"A valid, unique email is required."},{status:400});
 const checked=validatePhone(phone);if(!checked.valid)return NextResponse.json({error:"A valid, unique 10-digit phone number is required."},{status:400});
 const db=await createClient();
 const {data:rel,error:relError}=await db.from("client_relationships").select("id,relationship_type,related_traveller_id,traveller_profiles:related_traveller_id(id,briitely_contact_id,first_name,last_name)").eq("id",body.relationshipId).eq("primary_contact_id",id).maybeSingle();
 if(relError||!rel)return NextResponse.json({error:"Relationship not found."},{status:404});
 const profile=Array.isArray(rel.traveller_profiles)?rel.traveller_profiles[0]:rel.traveller_profiles;
 if(!profile)return NextResponse.json({error:"Traveller profile not found."},{status:404});
 if(profile.briitely_contact_id)return NextResponse.json({error:"This traveller already has a client record."},{status:409});
 try{
  const existing=await findContactByEmailOrPhone(email,checked.normalized);
  if(existing)return NextResponse.json({error:"Email or phone already belongs to a client. Open that client instead of creating a duplicate."},{status:409});
  const primary=body.useSameAddress?await getContact(id):null;
  const created=await upsertContact({firstName:profile.first_name,lastName:profile.last_name,email,phone:checked.normalized,
   ...(primary?{address1:primary.address1,city:primary.city,state:primary.state,postalCode:primary.postalCode,country:primary.country}:{})});
  if(!created.created)return NextResponse.json({error:"A matching client already exists; traveller was not linked."},{status:409});
  const {data:linked,error:linkError}=await db.from("traveller_profiles").update({briitely_contact_id:created.customer.id,email,phone:checked.normalized}).eq("id",profile.id).is("briitely_contact_id",null).select("id").maybeSingle();
  if(linkError||!linked)return NextResponse.json({error:"Client was created in Briitely, but linking the traveller failed. Please contact support to link the existing client instead of creating another."},{status:500});
  const {data:primaryProfile,error:primaryError}=await db.from("traveller_profiles").select("id").eq("briitely_contact_id",id).maybeSingle();
  if(primaryError)return NextResponse.json({error:"Client created and linked, but reverse relationship could not be loaded."},{status:500});
  if(primaryProfile){
   const inverse=rel.relationship_type==="child"||rel.relationship_type==="adult_child"?"parent":rel.relationship_type==="parent"?"child":rel.relationship_type;
   const {error:reverseError}=await db.from("client_relationships").upsert({primary_contact_id:created.customer.id,related_traveller_id:primaryProfile.id,relationship_type:inverse},{onConflict:"primary_contact_id,related_traveller_id"});
   if(reverseError)return NextResponse.json({error:"Client created and linked, but reverse relationship could not be saved."},{status:500});
  }
  return NextResponse.json({success:true,clientId:created.customer.id});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Could not create client."},{status:500})}
}
