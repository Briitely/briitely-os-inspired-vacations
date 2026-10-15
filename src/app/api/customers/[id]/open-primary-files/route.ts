import {NextResponse} from "next/server";
import {getAuthenticatedUser} from "@/lib/supabase/auth";
import {createClient} from "@/lib/supabase/server";
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
 const {user}=await getAuthenticatedUser();if(!user||!user.isActive)return NextResponse.json({error:"Unauthorized"},{status:401});
 const {id}=await params;const db=await createClient();
 const {data,error}=await db.from("travel_files").select("id,client_name,destination,departure_date,stage").eq("briitely_contact_id",id).eq("file_status","open").order("created_at",{ascending:false});
 if(error)return NextResponse.json({error:error.message},{status:500});
 return NextResponse.json({files:data??[]});
}
