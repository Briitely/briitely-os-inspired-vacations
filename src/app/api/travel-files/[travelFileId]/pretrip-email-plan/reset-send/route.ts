import{NextResponse}from"next/server";import{getAuthenticatedUser}from"@/lib/supabase/auth";import{createClient}from"@/lib/supabase/server";
export async function POST(request:Request,{params}:{params:Promise<{travelFileId:string}>}){
 const{user}=await getAuthenticatedUser();if(!user||!user.isActive)return NextResponse.json({error:"Authentication required."},{status:401});if(!["admin","super_admin"].includes(user.role))return NextResponse.json({error:"Admin access required."},{status:403});
 const{travelFileId}=await params,body=await request.json().catch(()=>null)as{email_code?:string}|null,code=body?.email_code?.trim();if(!code)return NextResponse.json({error:"Email code is required."},{status:400});
 const db=await createClient();const{data,error}=await db.from("travel_pretrip_emails").update({sent_at:null}).eq("travel_file_id",travelFileId).eq("email_code",code).select("email_code,email_name").maybeSingle();if(error)return NextResponse.json({error:error.message},{status:500});if(!data)return NextResponse.json({error:"Scheduled email not found."},{status:404});
 await db.from("travel_activity").insert({travel_file_id:travelFileId,event_type:"scheduled_trip_email_reset",summary:`${data.email_name} reset for resend/testing.`,actor_type:"internal",actor_user_id:user.id,metadata:{email_code:code}});
 return NextResponse.json({success:true,emailCode:code});
}