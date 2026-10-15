import {NextResponse} from "next/server";
import {getAuthenticatedUser} from "@/lib/supabase/auth";
import {createServiceClient} from "@/lib/supabase/service";

// Permanent deletion is deliberately unavailable when the profile is referenced
// by a travel file, another relationship, or another client.
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 const {user}=await getAuthenticatedUser();
 if(!user||!user.isActive||!["staff","admin","super_admin"].includes(user.role))return NextResponse.json({error:"Staff access required."},{status:403});
 const {id}=await params;
 const body=await req.json().catch(()=>null) as {relationshipId?:string;confirmation?:string}|null;
 if(!body?.relationshipId||body.confirmation!=="DELETE")return NextResponse.json({error:"Type DELETE to confirm permanent deletion."},{status:400});
 const db=createServiceClient();
 if(!db)return NextResponse.json({error:"Deletion service is not configured."},{status:503});
 const {data,error}=await db.rpc("delete_unlinked_traveller",{p_primary_contact_id:id,p_relationship_id:body.relationshipId});
 if(error)return NextResponse.json({error:error.message},{status:409});
 return NextResponse.json({deleted:Boolean(data)});
}
