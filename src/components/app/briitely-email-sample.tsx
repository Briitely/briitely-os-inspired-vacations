"use client";

import { useState } from "react";
import { CheckCircle2, CircleAlert, Loader2, Send } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { Input } from "@/components/core/ui/input";
import { Label } from "@/components/core/ui/label";

export function BriitelyEmailSample({ defaultEmail, enabled }: { defaultEmail: string; enabled: boolean }) {
  const [email, setEmail] = useState(defaultEmail);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/briitely-email-sample", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      setResult(res.ok ? { ok: true, text: data.message } : { ok: false, text: data.error || "The sample couldn't be sent." });
    } catch {
      setResult({ ok: false, text: "The sample couldn't be sent. Please try again." });
    } finally {
      setSending(false);
    }
  }

  if (!enabled) {
    return (
      <p className="text-sm text-muted-foreground">
        Create the Briitely workflow with an Inbound Webhook trigger, add its URL to Vercel as BRIITELY_EMAIL_WEBHOOK_URL and redeploy. This button then sends a sample so the trigger can fetch it.
      </p>
    );
  }

  return (
    <form onSubmit={send} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Sends the real invitation email, with this client&apos;s branding and a sample link, to the Briitely workflow. In Briitely, fetch the sample request on the Inbound Webhook trigger, then find or create the contact from <code>to</code> and <code>first_name</code>, and send to <code>to</code> / <code>cc</code> with <code>subject</code> and <code>body_html</code>.
      </p>
      <div className="space-y-2">
        <Label htmlFor="briitely-sample-email">Send the sample to</Label>
        <Input id="briitely-sample-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={sending} required />
        <p className="text-xs text-muted-foreground">Use an inbox you can check. When you test the workflow, the email goes here.</p>
      </div>
      <Button type="submit" variant="outline" disabled={sending || !email.trim()}>
        {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
        Send sample to Briitely
      </Button>
      {result && (
        <p className={`flex items-start gap-1.5 text-sm ${result.ok ? "text-muted-foreground" : "text-destructive"}`}>
          {result.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" /> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />}
          {result.text}
        </p>
      )}
    </form>
  );
}
