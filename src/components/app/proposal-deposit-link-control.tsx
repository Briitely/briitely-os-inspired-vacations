"use client";

import { useState } from "react";
import { Button } from "@/components/core/ui/button";

export function ProposalDepositLinkControl({ travelFileId }: { travelFileId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const [template,setTemplate]=useState<{subject:string;body_html:string}|null>(null);
  const [subject,setSubject]=useState("");
  const [html,setHtml]=useState("");
  const [recipient,setRecipient]=useState("");
  const [recipientName,setRecipientName]=useState("");
  async function prepare() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/travel-files/" + encodeURIComponent(travelFileId) + "/proposal-deposit-agreement", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not prepare agreement link.");
      setLink(result.url);
      const [templateResponse,travellersResponse]=await Promise.all([fetch("/api/email-templates/proposal_acceptance"),fetch("/api/travel-files/"+encodeURIComponent(travelFileId)+"/travellers")]);
      const templateResult=await templateResponse.json(),travellersResult=await travellersResponse.json();
      if(!templateResponse.ok)throw new Error(templateResult.error||"Proposal email template is not configured.");
      const primary=(travellersResult.party??[]).find((p:{traveller_role:string})=>p.traveller_role==="primary");
      const profile=Array.isArray(primary?.traveller_profiles)?primary.traveller_profiles[0]:primary?.traveller_profiles;
      const name=[profile?.preferred_name||profile?.first_name,profile?.last_name].filter(Boolean).join(" ");
      setRecipient(profile?.email??"");setRecipientName(name);
      setTemplate(templateResult.template);
      setSubject(templateResult.template.subject);
      setHtml(templateResult.template.body_html.replaceAll("{{secure_form_url}}",result.url).replaceAll("{{first_name}}",profile?.preferred_name||profile?.first_name||"there"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not prepare agreement link.");
    } finally {
      setBusy(false);
    }
  }
  async function send(){
    setBusy(true);setError("");
    try{
      if(!recipient.trim())throw new Error("Enter the recipient email address.");
      const response=await fetch("/api/travel-files/"+encodeURIComponent(travelFileId)+"/send-client-email",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({emailType:"proposal_acceptance",recipientEmail:recipient,recipientName,subject,htmlBody:html})});
      const result=await response.json();if(!response.ok)throw new Error(result.error||"Could not send email.");
      setLink("");setError("Email sent through Briitely.");
    }catch(e){setError(e instanceof Error?e.message:"Could not send email.")}finally{setBusy(false)}
  }
  return (
    <div className="flex flex-col items-start gap-2">
      <Button size="sm" disabled={busy} onClick={prepare}>{busy ? "Preparing…" : "Prepare Deposit Agreement Link"}</Button>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {link && <div className="max-w-full space-y-2 text-sm">
        <p className="font-medium">Review the email before sending. Only send after the approved agreement is configured.</p>
        <input className="w-full rounded border px-2 py-1" value={link} readOnly aria-label="Prepared agreement link" />
        <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(link)}>Copy Link</Button>
        {template&&<div className="space-y-2"><label className="block text-xs">To<input className="w-full rounded border p-2 text-sm" value={recipient} onChange={e=>setRecipient(e.target.value)}/></label><label className="block text-xs">Subject<input className="w-full rounded border p-2 text-sm" value={subject} onChange={e=>setSubject(e.target.value)}/></label><label className="block text-xs">Email body<textarea className="min-h-48 w-full rounded border p-2 text-sm" value={html} onChange={e=>setHtml(e.target.value)}/></label><Button size="sm" disabled={busy} onClick={send}>Send via Briitely</Button></div>}
      </div>}
    </div>
  );
}
