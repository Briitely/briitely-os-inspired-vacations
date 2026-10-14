import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

export async function generateAuthActionLink(input:{kind:"invite"|"recovery";email:string;redirectTo:string;firstName?:string|null;lastName?:string|null}) {
  const service=createServiceClient();
  if(!service) throw new Error("Supabase service client is not configured.");
  const {data,error}=await service.auth.admin.generateLink({
    type:input.kind,
    email:input.email,
    options:{
      redirectTo:input.redirectTo,
      data:input.kind==="invite"?{first_name:input.firstName??"",last_name:input.lastName??""}:undefined,
    },
  });
  if(error) throw error;
  const actionLink=data.properties?.action_link;
  if(!actionLink) throw new Error("Supabase did not return an action link.");
  return {actionLink,user:data.user};
}

export async function sendAuthEmail(input:{kind:"invite"|"recovery";email:string;firstName?:string|null;actionLink:string}) {
  const webhook=process.env.BRIITELY_AUTH_EMAIL_WEBHOOK_URL?.trim();
  if(!webhook) throw new Error("BRIITELY_AUTH_EMAIL_WEBHOOK_URL is not configured.");
  const response=await fetch(webhook,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      event:"dashboard_auth_email",
      email_type:input.kind==="invite"?"dashboard_invitation":"password_reset",
      email:input.email,
      first_name:input.firstName??"",
      action_link:input.actionLink,
    }),
    cache:"no-store",
  });
  if(!response.ok) throw new Error("Briitely auth email webhook returned "+response.status+".");
}
