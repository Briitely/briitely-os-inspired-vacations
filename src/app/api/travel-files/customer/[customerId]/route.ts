import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request:Request,{params}:{params:Promise<{customerId:string}>}){
 const {user}=await getAuthenticatedUser();if(!user)return NextResponse.json({error:"Authentication required."},{status:401});
 const {customerId}=await params,supabase=await createClient();
 const {data:profiles,error:profileError}=await supabase.from("traveller_profiles").select("id").eq("briitely_contact_id",customerId);
 if(profileError)return NextResponse.json({error:"Failed to load Travel Files."},{status:500});
 const profileIds=(profiles??[]).map(p=>p.id);let linkedIds:string[]=[];
 if(profileIds.length){const{data:links,error:linkError}=await supabase.from("travel_file_travellers").select("travel_file_id").in("traveller_profile_id",profileIds);if(linkError)return NextResponse.json({error:"Failed to load Travel Files."},{status:500});linkedIds=(links??[]).map(x=>x.travel_file_id)}
 const{data:primary,error:primaryError}=await supabase.from("travel_files").select("id").eq("briitely_contact_id",customerId);if(primaryError)return NextResponse.json({error:"Failed to load Travel Files."},{status:500});
 const ids=Array.from(new Set([...(primary??[]).map(x=>x.id),...linkedIds]));if(!ids.length)return NextResponse.json({files:[]});
 const{data,error}=await supabase.from("travel_files").select(`id,destination,stage,departure_date,file_status,current_action:travel_actions!current_action_id(title)`).in("id",ids).order("created_at",{ascending:false});
 if(error)return NextResponse.json({error:"Failed to load Travel Files."},{status:500});
 return NextResponse.json({files:data??[]});
}