import "server-only";
import crypto from "crypto";

export type EmailProvider="google"|"microsoft";
const providers={
 google:{authorize:"https://accounts.google.com/o/oauth2/v2/auth",token:"https://oauth2.googleapis.com/token",me:"https://www.googleapis.com/oauth2/v2/userinfo",scope:"openid email https://www.googleapis.com/auth/gmail.send"},
 microsoft:{authorize:"https://login.microsoftonline.com/common/oauth2/v2.0/authorize",token:"https://login.microsoftonline.com/common/oauth2/v2.0/token",me:"https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName",scope:"openid email offline_access User.Read Mail.Send"}
};
function config(provider:EmailProvider){const prefix=provider==="google"?"GOOGLE":"MICROSOFT";const clientId=process.env[`${prefix}_EMAIL_CLIENT_ID`],clientSecret=process.env[`${prefix}_EMAIL_CLIENT_SECRET`];if(!clientId||!clientSecret)throw new Error(`${provider} email OAuth is not configured.`);return{clientId,clientSecret,...providers[provider]}}
export function callbackUrl(provider:EmailProvider,origin:string){return `${origin}/api/email/connect/${provider}/callback`}
export function authorizationUrl(provider:EmailProvider,origin:string,state:string){const c=config(provider);return `${c.authorize}?${new URLSearchParams({client_id:c.clientId,redirect_uri:callbackUrl(provider,origin),response_type:"code",scope:c.scope,state,access_type:"offline",prompt:"consent"})}`}
export async function exchangeCode(provider:EmailProvider,origin:string,code:string){const c=config(provider);const body=new URLSearchParams({client_id:c.clientId,client_secret:c.clientSecret,code,redirect_uri:callbackUrl(provider,origin),grant_type:"authorization_code",scope:c.scope});const r=await fetch(c.token,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body});const d=await r.json();if(!r.ok||!d.access_token||!d.refresh_token)throw new Error(d.error_description||"Could not connect email account.");return d as {access_token:string;refresh_token:string;scope?:string}}
export async function mailboxIdentity(provider:EmailProvider,accessToken:string){const c=config(provider);const r=await fetch(c.me,{headers:{Authorization:`Bearer ${accessToken}`}});const d=await r.json();if(!r.ok)throw new Error("Could not read connected mailbox.");return provider==="google"?{id:String(d.id??""),email:String(d.email??"")}:{id:String(d.id??""),email:String(d.mail??d.userPrincipalName??"")}}
function key(){const raw=process.env.EMAIL_TOKEN_ENCRYPTION_KEY;if(!raw)throw new Error("EMAIL_TOKEN_ENCRYPTION_KEY is not configured.");return crypto.createHash("sha256").update(raw).digest()}
export function encryptToken(value:string){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv("aes-256-gcm",key(),iv);const encrypted=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);return [iv.toString("base64url"),cipher.getAuthTag().toString("base64url"),encrypted.toString("base64url")].join(".")}
