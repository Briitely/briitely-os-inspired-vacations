import {NextResponse} from "next/server";
import {getAuthenticatedUser} from "@/lib/supabase/auth";
import {createClient} from "@/lib/supabase/server";
import {createContactWithoutUpsert,findContactByEmailOrPhone} from "@/lib/briitely/contacts";
import {validatePhone} from "@/lib/briitely/query";
export async function POST(request:Request,{params}:{params:Promise<{travelFileId:string}>}){
 const {user}=await getAuthenticatedUser();if(!user||!user.isActive||!["staff","admin","super_admin"].includes(user.role))return NextResponse.json({error:"Staff access required"},{status:403});
 const {travelFileId}=await params;const body=await request.json().catch(()=>null) as {profileId?:string;email?:string;phone?:string;address1?:string;city?:string;state?:string;postalCode?:string;country?:string}|null;
 if(!body?.profileId)return NextResponse.json({error:"Select a traveller"},{status:400});
 const email=body.email?.trim().toLowerCase()||"",phone=body.phone?.trim()||"";
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return NextResponse.json({error:"Enter a valid email or leave blank"},{status:400});
 const checked=phone?validatePhone(phone):null;if(checked&&!checked.valid)return NextResponse.json({error:"Enter a valid phone or leave blank"},{status:400});
 const db=await createClient();
 const {data:member,error:memberError}=await db.from("travel_file_travellers").select("traveller_profile_id,traveller_profiles:traveller_profile_id(id,first_name,last_name,briitely_contact_id,is_deceased)").eq("travel_file_id",travelFileId).eq("traveller_profile_id",body.profileId).maybeSingle();
 if(memberError||!member)return NextResponse.json({error:"Traveller is not part of this trip"},{status:404});
 const p=Array.isArray(member.traveller_profiles)?member.traveller_profiles[0]:member.traveller_profiles;
 if(!p||p.is_deceased)return NextResponse.json({error:"Cannot assign a deceased traveller"},{status:400});
 if(p.briitely_contact_id)return NextResponse.json({success:true,clientId:p.briitely_contact_id,alreadyLinked:true});
 try{
  const existing=await findContactByEmailOrPhone(email,checked?.normalized);
  if(existing)return NextResponse.json({error:"Email or phone belongs to another client. Connect that client instead of creating a duplicate."},{status:409});
  const created=await createContactWithoutUpsert({firstName:p.first_name,lastName:p.last_name,...(email?{email}:{}),...(checked?{phone:checked.normalized}:{}),address1:body.address1?.trim(),city:body.city?.trim(),state:body.state?.trim(),postalCode:body.postalCode?.trim(),country:body.country?.trim()});
  const {data:linked,error}=await db.from("traveller_profiles").update({briitely_contact_id:created.id,email:email||null,phone:checked?.normalized||null}).eq("id",p.id).is("briitely_contact_id",null).select("id").maybeSingle();
  if(error||!linked)return NextResponse.json({error:"Client created in Briitely but could not link the traveller. Do not retry creation; connect the existing client.",clientId:created.id},{status:500});
  return NextResponse.json({success:true,clientId:created.id});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Could not create client"},{status:500})}
}
