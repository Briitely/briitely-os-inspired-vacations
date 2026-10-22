import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { generateAuthActionLink, sendAuthEmail } from "@/lib/auth/auth-email";
import { getPublicAppOrigin } from "@/lib/auth/public-origin";

const EMAIL_PATTERN=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request:Request){
  let email="";
  try{
    const body=await request.json() as {email?:string};
    email=(body.email??"").trim().toLowerCase();
  }catch{
    return NextResponse.json({success:true});
  }

  if(!email||!EMAIL_PATTERN.test(email)) return NextResponse.json({success:true});

  try{
    const service=createServiceClient();
    if(!service) throw new Error("Supabase service client is not configured.");

    const {data}=await service.auth.admin.listUsers({page:1,perPage:1000});
    const authUser=data.users.find((u)=>u.email?.toLowerCase()===email);
    if(!authUser) return NextResponse.json({success:true});

    const {data:profile}=await service
      .from("profiles")
      .select("first_name,last_name,is_active")
      .eq("id",authUser.id)
      .maybeSingle();

    if(profile?.is_active===false) return NextResponse.json({success:true});

    const origin=getPublicAppOrigin(request);
    const {actionLink}=await generateAuthActionLink({
      kind:"recovery",
      email,
      redirectTo:origin+"/auth/callback?next=/reset-password",
      firstName:profile?.first_name??null,
    });

    await sendAuthEmail({kind:"recovery",email,firstName:profile?.first_name??null,lastName:profile?.last_name??null,actionLink});
  }catch(error){
    console.error("AUTH_PASSWORD_RESET_SEND_FAILED",{email,message:error instanceof Error?error.message:"unknown"});
  }

  return NextResponse.json({success:true});
}
