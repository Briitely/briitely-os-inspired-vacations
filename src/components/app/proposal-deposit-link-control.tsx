"use client";

import { useState } from "react";
import { Button } from "@/components/core/ui/button";

export function ProposalDepositLinkControl({ travelFileId }: { travelFileId: string }) {
  const [busy, setBusy] = useState(false);
  const [open,setOpen]=useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const [template,setTemplate]=useState<{subject:string;body_html:string}|null>(null);
  const [subject,setSubject]=useState("");
  const [html,setHtml]=useState("");
  const [recipient,setRecipient]=useState("");
  const [recipientName,setRecipientName]=useState("");
  async function prepare() {
    setOpen(true);
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
  function format(command:string,value?:string){document.execCommand(command,false,value);const editor=document.getElementById("proposal-email-editor");if(editor)setHtml(editor.innerHTML)}
  return (
    <>
      <Button size="sm" disabled={busy} onClick={prepare}>{busy ? "Preparing…" : "Prepare Deposit Agreement Email"}</Button>
      {open&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setOpen(false)}}>
        <div role="dialog" aria-modal="true" aria-label="Prepare proposal acceptance email" className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-background shadow-xl">
          <div className="flex items-center justify-between border-b p-5"><div><h2 className="text-lg font-semibold">Proposal Acceptance & Deposit Agreement</h2><p className="text-sm text-muted-foreground">Review the email and secure form link before sending.</p></div><Button variant="outline" size="sm" disabled={busy} onClick={()=>setOpen(false)}>Close</Button></div>
          <div className="space-y-4 overflow-y-auto p-5">
            {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
            {busy&&!link&&<p className="text-sm">Preparing secure link…</p>}
            {link&&<><div className="flex gap-2"><input className="min-w-0 flex-1 rounded border p-2 text-sm" value={link} readOnly aria-label="Secure proposal link"/><Button variant="outline" size="sm" onClick={()=>navigator.clipboard.writeText(link)}>Copy Link</Button></div>
              <label className="block text-sm font-medium">To<input className="mt-1 w-full rounded border p-2 font-normal" value={recipient} onChange={e=>setRecipient(e.target.value)}/></label>
              <label className="block text-sm font-medium">Subject<input className="mt-1 w-full rounded border p-2 font-normal" value={subject} onChange={e=>setSubject(e.target.value)}/></label>
              <div className="space-y-2"><span className="text-sm font-medium">Email message</span><div className="flex gap-2 border-b pb-2"><Button size="sm" variant="outline" onMouseDown={e=>e.preventDefault()} onClick={()=>format("bold")}>Bold</Button><Button size="sm" variant="outline" onMouseDown={e=>e.preventDefault()} onClick={()=>format("italic")}>Italic</Button><Button size="sm" variant="outline" onClick={()=>{const url=window.prompt("Link URL");if(url)format("createLink",url)}}>Link</Button></div><div id="proposal-email-editor" contentEditable suppressContentEditableWarning onInput={e=>setHtml(e.currentTarget.innerHTML)} dangerouslySetInnerHTML={{__html:html}} className="min-h-48 rounded border p-3 text-sm focus:outline-primary"/></div>
            </>}
          </div>
          <div className="flex justify-end gap-2 border-t p-4"><Button variant="outline" disabled={busy} onClick={()=>setOpen(false)}>Cancel</Button><Button disabled={busy||!link||!recipient||!subject} onClick={send}>{busy?"Sending…":"Send via Briitely"}</Button></div>
        </div>
      </div>}
    </>
  );
}
