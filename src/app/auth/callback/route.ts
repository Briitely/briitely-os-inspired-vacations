import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function safeNext(value:string|null){
  if(value==="/reset-password"||value==="/accept-invite") return value;
  return "/login";
}

export async function GET(request:Request){
  const url=new URL(request.url);
  const code=url.searchParams.get("code");
  const next=safeNext(url.searchParams.get("next"));

  if(!code){
    return NextResponse.redirect(new URL(next+"?error=missing_code",url.origin));
  }

  const supabase=await createClient();
  const {error}=await supabase.auth.exchangeCodeForSession(code);

  if(error){
    console.error("AUTH_CALLBACK_EXCHANGE_FAILED",{message:error.message,next});
    return NextResponse.redirect(new URL(next+"?error=invalid_or_expired",url.origin));
  }

  return NextResponse.redirect(new URL(next,url.origin));
}
