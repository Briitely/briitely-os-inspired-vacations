import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(){
  const auth=await requireAuthenticatedUser();if(!auth)return NextResponse.json({error:"Unauthorized"},{status:401});
  const supabase=await createClient();
  const {data,error}=await supabase.from("profiles").select("first_name,last_name,full_name,email,sender_email").eq("id",auth.user.id).single();
  if(error)return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json(data);
}

export async function PATCH(req:Request){
  const auth=await requireAuthenticatedUser();if(!auth)return NextResponse.json({error:"Unauthorized"},{status:401});
  const body=await req.json();const firstName=String(body.firstName??"").trim(),lastName=String(body.lastName??"").trim(),loginEmail=String(body.loginEmail??"").trim().toLowerCase(),senderEmail=String(body.senderEmail??"").trim().toLowerCase();
  if(!firstName||!lastName||!loginEmail||!senderEmail)return NextResponse.json({error:"Name and email fields are required."},{status:400});
  const supabase=await createClient();let emailConfirmationRequired=false;
  if(loginEmail!==auth.user.email.toLowerCase()){
    const {error}=await supabase.auth.updateUser({email:loginEmail});
    if(error)return NextResponse.json({error:error.message},{status:400});
    emailConfirmationRequired=true;
  }
  const fullName=`${firstName} ${lastName}`.trim();
  const {error}=await supabase.from("profiles").update({first_name:firstName,last_name:lastName,full_name:fullName,sender_email:senderEmail}).eq("id",auth.user.id);
  if(error)return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({ok:true,emailConfirmationRequired});
}
