import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { getBrandingSettings, getBusinessSettings, getInvitationContactSettings } from "@/lib/briitely/client-settings";
import { formatPhoneNumber } from "@/lib/format/phone";
import { canChangeBriitely } from "@/lib/environment";

/** The Briitely email workflow URL, unless this test build may not use Briitely (lib/environment.ts). */
function emailWebhookUrl(): string | undefined {
  return canChangeBriitely() ? process.env.BRIITELY_EMAIL_WEBHOOK_URL?.trim() : undefined;
}

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

function wrapActionLink(kind:"invite"|"recovery", actionLink:string) {
  const sourceUrl=new URL(actionLink);
  const redirectTo=sourceUrl.searchParams.get("redirect_to") || sourceUrl.searchParams.get("redirectTo") || "";
  if(!redirectTo) throw new Error("Supabase auth link is missing its redirect target.");

  let appOrigin="";
  try{
    appOrigin=new URL(redirectTo).origin;
  }catch{
    throw new Error("Supabase auth link contains an invalid redirect target.");
  }

    // The verify link's `token` param is the hashed token that verifyOtp accepts.
  const tokenHash=sourceUrl.searchParams.get("token") || "";
  if(!tokenHash) throw new Error("Supabase auth link is missing its token.");

  const safeUrl=new URL("/auth/continue",appOrigin);
  safeUrl.searchParams.set("kind",kind);
  safeUrl.searchParams.set("token_hash",tokenHash);
  return safeUrl.toString();
}

/** The standard Briitely email workflow (same as every Briitely OS dashboard). */
export function isStandardEmailWorkflowEnabled(): boolean {
  return Boolean(emailWebhookUrl());
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** The branded sign-in email, built by the dashboard (same design as Core and High Q). */
async function renderAuthEmail(kind: "invite" | "recovery", firstName: string, link: string): Promise<{ subject: string; html: string }> {
  const [business, branding, support] = await Promise.all([getBusinessSettings(), getBrandingSettings(), getInvitationContactSettings().catch(() => ({ name: "", email: "", phone: "" }))]);
  const name = business.businessName || "Inspired Vacations";
  const businessName = escapeHtml(name);
  const logoUrl = branding.logoUrl || business.logoUrl || "";
  const accent = /^#[0-9a-f]{6}$/i.test(branding.primaryColor) ? branding.primaryColor : "#0b4f8a";
  const greeting = firstName.trim() ? `Hi ${escapeHtml(firstName.trim())},` : "Hi,";
  const safeLink = escapeHtml(link);
  const copy = kind === "invite"
    ? { subject: `You're invited to the ${name} dashboard`, heading: "You've been invited", body: `You've been invited to create an account for the operational dashboard for <strong>${businessName}</strong>. Use the button below to accept your invitation and create your password.`, button: "Accept invitation", footnote: "This link can be used once. If it has expired, ask your administrator to resend your invitation." }
    : { subject: `Reset your ${name} dashboard password`, heading: "Reset your password", body: `We received a request to reset the password for your <strong>${businessName}</strong> dashboard account. Use the button below to choose a new password.`, button: "Choose a new password", footnote: "This link can be used once. If you didn't ask for a password reset, you can ignore this email." };
  const supportBlock = support.name || support.email || support.phone
    ? `<div style="border-top:1px solid #e5e7eb;padding-top:22px;margin-top:28px;"><p style="font-size:14px;line-height:1.6;color:#666;margin:0 0 10px;">If you have any questions or have difficulty signing in, please contact:</p><p style="font-size:14px;line-height:1.7;margin:0;">${support.name ? `<strong>${escapeHtml(support.name)}</strong><br>` : ""}${support.email ? `<a href="mailto:${escapeHtml(support.email)}" style="color:${accent};">${escapeHtml(support.email)}</a><br>` : ""}${escapeHtml(formatPhoneNumber(support.phone || ""))}</p></div>`
    : "";
  const logoBlock = logoUrl ? `<div style="border-top:1px solid #e5e7eb;margin-top:26px;padding-top:24px;text-align:center;"><img src="${escapeHtml(logoUrl)}" alt="${businessName}" style="display:inline-block;max-width:220px;max-height:90px;width:auto;height:auto;"></div>` : "";
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f6f7f8;font-family:Arial,Helvetica,sans-serif;color:#252525;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7f8;padding:32px 16px;"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:12px;padding:36px;"><tr><td><h1 style="font-size:24px;margin:0 0 20px;">${copy.heading}</h1><p style="font-size:16px;line-height:1.6;margin:0 0 12px;">${greeting}</p><p style="font-size:16px;line-height:1.6;margin:0 0 20px;">${copy.body}</p><p style="margin:28px 0;"><a href="${safeLink}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;font-weight:700;padding:13px 22px;border-radius:8px;">${copy.button}</a></p><p style="font-size:13px;line-height:1.6;color:#666;margin:0;">${copy.footnote}</p>${supportBlock}${logoBlock}</td></tr></table></td></tr></table></body></html>`;
  return { subject: copy.subject, html };
}

async function postJson(webhook: string, payload: Record<string, unknown>) {
  const response = await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), cache: "no-store" });
  if (!response.ok) throw new Error("Briitely email webhook returned " + response.status + ".");
}

/**
 * Sends an invitation or password reset.
 * Standard (BRIITELY_EMAIL_WEBHOOK_URL set): the dashboard builds the branded email and the
 * Briitely email workflow sends it (to, cc, first_name, last_name, subject, body_html), plus the names
 * IV's templated-email workflow already reads (email, email_subject, email_html, contact_name).
 * Until that's set: the older IV auth workflow (BRIITELY_AUTH_EMAIL_WEBHOOK_URL), whose email is written in GHL.
 */
export async function sendAuthEmail(input: { kind: "invite" | "recovery"; email: string; firstName?: string | null; lastName?: string | null; actionLink: string }) {
  const link = wrapActionLink(input.kind, input.actionLink);
  const emailType = input.kind === "invite" ? "dashboard_invitation" : "password_reset";
  const standard = emailWebhookUrl();
  if (standard) {
    const { subject, html } = await renderAuthEmail(input.kind, input.firstName ?? "", link);
    await postJson(standard, { event: "dashboard_auth_email", email_type: emailType, to: input.email, cc: "", first_name: input.firstName ?? "", last_name: input.lastName ?? "", subject, body_html: html, email: input.email, email_subject: subject, email_html: html, contact_name: input.firstName ?? "", action_link: link });
    return;
  }
  const legacy = process.env.BRIITELY_AUTH_EMAIL_WEBHOOK_URL?.trim();
  if (!legacy) throw new Error("No Briitely email webhook is configured.");
  await postJson(legacy, { event: "dashboard_auth_email", email_type: emailType, email: input.email, first_name: input.firstName ?? "", action_link: link });
}

/** Sends a sample invitation (your own email, placeholder link) so the workflow trigger can map the fields. */
export async function sendSampleAuthEmail(input: { email: string; firstName: string; lastName: string; origin: string }) {
  const webhook = emailWebhookUrl();
  if (!webhook) throw new Error("Add BRIITELY_EMAIL_WEBHOOK_URL in Vercel first.");
  const link = new URL("/auth/continue?kind=invite&token_hash=sample-token", input.origin).toString();
  const { subject, html } = await renderAuthEmail("invite", input.firstName, link);
  await postJson(webhook, { event: "dashboard_auth_email", email_type: "dashboard_invitation", to: input.email, cc: "", first_name: input.firstName, last_name: input.lastName, subject, body_html: html, email: input.email, email_subject: subject, email_html: html, contact_name: input.firstName, action_link: link });
}
