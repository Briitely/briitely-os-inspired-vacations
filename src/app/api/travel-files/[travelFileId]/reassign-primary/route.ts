import {NextResponse} from "next/server";
import {getAuthenticatedUser} from "@/lib/supabase/auth";
import {createServiceClient} from "@/lib/supabase/service";
export async function GET(_request:Request,{params}:{params:Promise<{travelFileId:string}>}){
 const {user}=await getAuthenticatedUser();if(!user||!user.isActive)return NextResponse.json({error:"Unauthorized"},{status:401});
 const {travelFileId}=await params;const db=createServiceClient();if(!db)return NextResponse.json({error:"Service unavailable"},{status:503});
 const {data:members,error}=await db.from("travel_file_travellers").select("traveller_profile_id,traveller_role,traveller_profiles:traveller_profile_id(id,first_name,last_name,briitely_contact_id,is_deceased)").eq("travel_file_id",travelFileId);
 if(error)return NextResponse.json({error:error.message},{status:500});
 return NextResponse.json({members:members??[]});
}
export async function POST(request:Request,{params}:{params:Promise<{travelFileId:string}>}){
 const {user}=await getAuthenticatedUser();if(!user||!user.isActive||!["staff","admin","super_admin"].includes(user.role))return NextResponse.json({error:"Staff access required"},{status:403});
 const {travelFileId}=await params;const body=await request.json().catch(()=>null) as {profileId?:string}|null;
 if(!body?.profileId)return NextResponse.json({error:"Choose a traveller"},{status:400});
 const db=createServiceClient();if(!db)return NextResponse.json({error:"Service unavailable"},{status:503});
 const {data,error}=await db.rpc("reassign_travel_file_primary",{p_file_id:travelFileId,p_new_profile_id:body.profileId,p_actor_id:user.id});
 if(error)return NextResponse.json({error:error.message},{status:409});
 return NextResponse.json({success:true,changed:data});
}
