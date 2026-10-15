import {NextResponse} from "next/server";
import {getAuthenticatedUser} from "@/lib/supabase/auth";
import {createClient} from "@/lib/supabase/server";
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 const {user}=await getAuthenticatedUser();
 if(!user||!user.isActive||!["staff","admin","super_admin"].includes(user.role))return NextResponse.json({error:"Staff access required."},{status:403});
 const {id}=await params;const body=await req.json().catch(()=>null) as {relationshipId?:string;deceased?:boolean;confirmation?:string}|null;
 if(!body?.relationshipId||typeof body.deceased!=="boolean")return NextResponse.json({error:"Relationship and status required."},{status:400});
 if(body.deceased===false&&body.confirmation!=="REMOVE DECEASED")return NextResponse.json({error:"Type REMOVE DECEASED to confirm."},{status:400});
 const db=await createClient();
 const {data:rel,error}=await db.from("client_relationships").select("related_traveller_id").eq("id",body.relationshipId).eq("primary_contact_id",id).maybeSingle();
 if(error||!rel)return NextResponse.json({error:"Relationship not found."},{status:404});
 const {data:profile,error:updateError}=await db.from("traveller_profiles").update({is_deceased:body.deceased,deceased_at:null}).eq("id",rel.related_traveller_id).select("id,is_deceased").single();
 if(updateError||!profile)return NextResponse.json({error:updateError?.message??"Could not update deceased status."},{status:500});
 return NextResponse.json({profile});
}
