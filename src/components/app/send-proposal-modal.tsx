"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, X } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { Input } from "@/components/core/ui/input";
import { Label } from "@/components/core/ui/label";

type Props = { travelFileId: string; isOpen: boolean; onClose: () => void };
type Recipient = { partyMemberId: string; contactId: string | null; name: string; email: string; isPrimary: boolean };

const first = (value: string) => value.trim().split(/\s+/)[0] || "there";
const advisorFirst = (value: string) => value.trim().split(/\s+/)[0] || "Your Inspired Vacations Advisor";

function applyTemplate(template:{subject:string;body_html:string}|null,name:string,url:string,advisor:string){if(!template)return null;const replace=(v:string)=>v.replaceAll("{{first_name}}",first(name)).replaceAll("{{advisor_first_name}}",advisorFirst(advisor)).replaceAll("{{travefy_proposal_url}}",url);return{subject:replace(template.subject),html:replace(template.body_html)}}

function makeEmail(name: string, url: string, advisor: string) {
  return `<div>Hi ${first(name)},</div><div><br></div><div>Exciting news — your personalized travel proposal is ready! 🎉 We've crafted it just for you, packed with options and ideas to make your trip unforgettable.</div><div><br></div><div>You should also see it from Travefy in your inbox. If it doesn't appear, please check your spam or junk folder.</div><div><br></div><div>👉 <a href="${url}" style="text-decoration: underline;">View Your Custom Trip Proposal</a></div><div><br></div><div>Take your time to explore it, and if you have any questions, want to tweak something, or just want to chat about your options, we're here and happy to help. Just hit reply on this email and we'll get back to you! 🌺</div><div><br></div><div>We can't wait to hear what you think!</div><div><br></div><div>Cheers,</div><div><br></div><div>${advisorFirst(advisor)} &amp; the Inspired Vacations Team ✈️</div>`;
}

function personalizeGreeting(html: string, originalName: string, recipientName: string) {
  const original = `Hi ${first(originalName)},`;
  const replacement = `Hi ${first(recipientName)},`;
  return html.includes(original) ? html.replace(original, replacement) : html;
}

export function SendProposalModal({ travelFileId, isOpen, onClose }: Props) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [clientName, setClientName] = useState("Client");
  const [advisor, setAdvisor] = useState("Your Inspired Vacations Advisor");
  const [prepared, setPrepared] = useState(false);
  const [subject, setSubject] = useState("🌴 Your Custom Trip Proposal is Ready! ✈️");
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [sendToTripCommunications, setSendToTripCommunications] = useState(false);
  const [template,setTemplate]=useState<{subject:string;body_html:string}|null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setPrepared(false);
    setSent(false);
    setError(null);
    setSendToTripCommunications(false);
    Promise.all([
      fetch(`/api/travel-files/${travelFileId}/proposal-send`).then((response) => response.json()),
      fetch(`/api/travel-files/${travelFileId}/trip-communication-recipients`).then((response) => response.json()),
      fetch(`/api/email-templates/proposal_initial`).then((response)=>response.json()),
    ]).then(([proposal, communication, templateData]) => {
      setUrl(proposal.travefyProposalUrl ?? "");
      setEmail(proposal.email ?? "");
      setClientName(proposal.clientName ?? proposal.firstName ?? "Client");
      setAdvisor(proposal.assignedAdvisorName ?? "Your Inspired Vacations Advisor");
      setRecipients(communication.recipients ?? []);
      setTemplate(templateData.template??null);
    }).catch(() => {});
  }, [isOpen, travelFileId]);

  async function prepare(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/travel-files/${travelFileId}/proposal-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "prepare", sentViaTravefy: sent, travefyProposalUrl: url }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Could not prepare proposal email.");
      const rendered=applyTemplate(template,clientName,data.travefyProposalUrl,advisor);
      if(rendered){setSubject(rendered.subject);setHtml(rendered.html)}else setHtml(makeEmail(clientName, data.travefyProposalUrl, advisor));
      setPrepared(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not prepare proposal email.");
    } finally {
      setLoading(false);
    }
  }

  async function sendOne(recipient: Recipient) {
    const response = await fetch(`/api/travel-files/${travelFileId}/send-client-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        emailType: "proposal",
        recipientContactId: recipient.contactId,
        recipientName: recipient.name,
        recipientEmail: recipient.email,
        subject,
        htmlBody: personalizeGreeting(html, clientName, recipient.name),
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error ?? `Could not send proposal email to ${recipient.name}.`);
  }

  async function sendEmail() {
    setLoading(true);
    setError(null);
    try {
      const primaryFromList = recipients.find((recipient) => recipient.isPrimary);
      const primary: Recipient = primaryFromList ?? {
        partyMemberId: "primary",
        contactId: null,
        name: clientName,
        email,
        isPrimary: true,
      };
      const sendList = sendToTripCommunications ? recipients : [primary];
      if (!sendList.length) throw new Error("No travellers receiving trip communications have an email address.");
      for (const recipient of sendList) await sendOne(recipient);

      const response = await fetch(`/api/travel-files/${travelFileId}/proposal-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark-sent" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Email sent, but the Travel File could not be advanced.");
      onClose();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send proposal email.");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;
  const additionalRecipients = recipients.filter((recipient) => !recipient.isPrimary);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-background shadow-xl">
        <div className="flex items-center border-b px-6 py-5">
          <h2 className="text-lg font-semibold">Send Proposal</h2>
          <button type="button" className="ml-auto" onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        {!prepared ? (
          <form onSubmit={prepare}>
            <div className="space-y-5 p-6">
              <div className="space-y-2">
                <Label>Travefy Proposal URL *</Label>
                <Input type="url" value={url} onChange={(event) => setUrl(event.target.value)} required />
                <p className="text-xs text-muted-foreground">This will be saved to Booking & Planning on the Travel File.</p>
              </div>
              <label className="flex items-start gap-3 rounded-md border p-4">
                <input type="checkbox" checked={sent} onChange={(event) => setSent(event.target.checked)} className="mt-1 h-4 w-4" required />
                <span><span className="block text-sm font-medium">Have you sent the proposal via Travefy? *</span><span className="block text-xs text-muted-foreground">Confirm the Travefy proposal has been sent before preparing the follow-up email.</span></span>
              </label>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t p-4">
              <Button size="sm" type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button size="sm" type="submit" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Prepare Email</Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4 p-5">
            <p className="text-sm">To: {clientName} &lt;{email}&gt;</p>
            {additionalRecipients.length > 0 && (
              <label className="flex items-start gap-3 rounded-md border p-3">
                <input type="checkbox" checked={sendToTripCommunications} onChange={(event) => setSendToTripCommunications(event.target.checked)} className="mt-1 h-4 w-4" />
                <span>
                  <span className="block text-sm font-medium">Send to all travellers receiving trip communications</span>
                  <span className="block text-xs text-muted-foreground">Also sends a separate copy to {additionalRecipients.map((recipient) => recipient.name).join(", ")}.</span>
                </span>
              </label>
            )}
            <label className="block text-sm font-medium">Subject<input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={subject} onChange={(event) => setSubject(event.target.value)} /></label>
            <div>
              <div className="mb-1 text-sm font-medium">Message</div>
              <div className="min-h-64 rounded-md border p-3 text-sm leading-5 outline-none [&_a]:text-primary [&_a]:underline" contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: html }} onInput={(event) => setHtml(event.currentTarget.innerHTML)} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setPrepared(false)}>Back</Button>
              <Button size="sm" onClick={sendEmail} disabled={loading || !email || !subject.trim() || !html.trim()}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Send through Briitely</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
