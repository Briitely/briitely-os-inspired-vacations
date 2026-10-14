import { NextResponse } from "next/server";

function isAllowedSupabaseActionLink(value:string){
  try{
    const url=new URL(value);
    const configured=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL||"");
    return url.protocol==="https:" &&
      url.hostname===configured.hostname &&
      url.pathname.startsWith("/auth/v1/verify");
  }catch{
    return false;
  }
}

export async function POST(request:Request){
  const form=await request.formData();
  const action=String(form.get("action")||"");
  if(!isAllowedSupabaseActionLink(action)){
    return NextResponse.redirect(new URL("/login",request.url),303);
  }
  return NextResponse.redirect(action,303);
}
