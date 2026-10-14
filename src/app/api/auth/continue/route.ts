import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// Admin-generated (generateLink) links cannot use PKCE, so Supabase's
// /auth/v1/verify redirect puts tokens in the URL #hash, which our PKCE
// browser client and server routes never see. Instead we verify the
// one-time token_hash here, server-side, only when the person clicks the
// button (so email link scanners can't burn the token), and store the
// session in cookies before sending them to the reset / invite page.
export async function POST(request:NextRequest){
  const form=await request.formData();
  const tokenHash=String(form.get("token_hash")||"").trim();
  const kind=String(form.get("kind")||"")==="invite"?"invite":"recovery";
  const next=kind==="invite"?"/accept-invite":"/reset-password";

  if(!tokenHash){
    return NextResponse.redirect(new URL(next+"?error=invalid_or_expired",request.url),303);
  }

  const response=NextResponse.redirect(new URL(next,request.url),303);
  const supabase=createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!,
    {
      cookies:{
        getAll(){
          return request.cookies.getAll();
        },
        setAll(cookiesToSet:{name:string;value:string;options:CookieOptions}[]){
          cookiesToSet.forEach(({name,value,options})=>response.cookies.set(name,value,options));
        },
      },
    }
  );

  const {error}=await supabase.auth.verifyOtp({type:kind,token_hash:tokenHash});
  if(error){
    console.error("AUTH_CONTINUE_VERIFY_FAILED",{kind,message:error.message});
    return NextResponse.redirect(new URL(next+"?error=invalid_or_expired",request.url),303);
  }
  return response;
}
