import {NextResponse} from "next/server";
import {getAuthenticatedUser} from "@/lib/supabase/auth";
import {createClient} from "@/lib/supabase/server";

// Permanent deletion is deliberately unavailable when the profile is referenced
// by a travel file, another relationship, or another client.
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 const {user}=await getAuthenticatedUser();
 if(!user||!user.isActive||!["staff","admin","super_admin"].includes(user.role))return NextResponse.json({error:"Staff access required."},{status:403});
 const {id}=await params;
 const body=await req.json().catch(()=>null) as {relationshipId?:string;confirmation?:string}|null;
 if(!body?.relationshipId||body.confirmation!=="DELETE")return NextResponse.json({error:"Type DELETE to confirm permanent deletion."},{status:400});
 const db=await createClient();
 const {data:rel,error:relError}=await db.from("client_relationships").select("id,related_traveller_id,traveller_profiles:related_traveller_id(id,briitely_contact_id)").eq("id",body.relationshipId).eq("primary_contact_id",id).maybeSingle();
 if(relError||!rel)return NextResponse.json({error:"Relationship not found."},{status:404});
 const profile=Array.isArray(rel.traveller_profiles)?rel.traveller_profiles[0]:rel.traveller_profiles;
 if(!profile||profile.briitely_contact_id)return NextResponse.json({error:"This traveller has a client file; use Unlink Relationship instead."},{status:409});
 const profileId=profile.id;
 const {count:tripCount,error:tripError}=await db.from("travel_file_travellers").select("id",{count:"exact",head:true}).eq("traveller_profile_id",profileId);
 if(tripError)return NextResponse.json({error:"Could not verify travel history. Deletion blocked: "+tripError.message},{status:500});
 if(tripCount)return NextResponse.json({error:"This traveller has travel history or an active booking. Create a separate client file to preserve their information before unlinking."},{status:409});
 const {count:relationshipCount,error:otherError}=await db.from("client_relationships").select("id",{count:"exact",head:true}).eq("related_traveller_id",profileId);
 if(otherError||relationshipCount!==1)return NextResponse.json({error:"Traveller has other relationships or references. Deletion blocked."},{status:409});
 // Deleting the profile only succeeds when database foreign keys allow it.
 // Restricting FK constraints protect other tables not covered by the UI check.
 const {error:unlinkError}=await db.from("client_relationships").delete().eq("id",rel.id).eq("primary_contact_id",id);
 if(unlinkError)return NextResponse.json({error:unlinkError.message},{status:500});
 const {error:deleteError}=await db.from("traveller_profiles").delete().eq("id",profileId).is("briitely_contact_id",null);
 if(deleteError)return NextResponse.json({error:"Relationship unlinked, but traveller profile could not be deleted. Other records may reference this traveller: "+deleteError.message},{status:409});
 return NextResponse.json({deleted:true});
}
