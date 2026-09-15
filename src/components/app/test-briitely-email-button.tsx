"use client";

import { useState } from "react";
import { Loader2, MailCheck, X } from "lucide-react";
import { Button } from "@/components/core/ui/button";

export function TestBriitelyEmailButton({ travelFileId }: { travelFileId: string }) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subject, setSubject] = useState("Dynamic Briitely Email Test — Punta Mita");
  const [htmlBody, setHtmlBody] = useState("<p>Hi Alan,</p><p>This email was edited <strong>inside the Inspired Vacations dashboard</strong> before being sent through Briitely.</p><p>Change anything in this message, then click Send Test Email.</p><p>Cheers,<br>Inspired Vacations</p>");

  async function sendTest() {
    setSending(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(
        `/api/travel-files/${encodeURIComponent(travelFileId)}/test-email-webhook`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject, htmlBody }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Could not send the test webhook.");
      setMessage(`Test sent to ${data.payload?.email ?? "Briitely"}.`);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the test webhook.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-1">
      <Button type="button" size="sm" variant="outline" onClick={() => { setOpen(true); setMessage(null); setError(null); }}>
        <MailCheck className="h-4 w-4" />
        Test Briitely Email
      </Button>
      {message && <p className="text-xs text-emerald-700">{message}</p>}
      {error && !open && <p className="max-w-sm text-xs text-destructive">{error}</p>}

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-background p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Edit Briitely Email</h2>
                <p className="text-sm text-muted-foreground">Edit the subject and HTML below. Briitely will send exactly what you approve here.</p>
              </div>
              <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted" onClick={() => setOpen(false)} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>

            <label className="mb-4 block space-y-1.5">
              <span className="text-sm font-medium">Subject</span>
              <input className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Email body</span>
              <textarea className="min-h-[280px] w-full rounded-md border bg-background px-3 py-2 font-mono text-sm" value={htmlBody} onChange={(e) => setHtmlBody(e.target.value)} />
              <span className="block text-xs text-muted-foreground">For this proof of concept the body is editable HTML. We can replace this with a normal rich-text editor for the real email composer.</span>
            </label>

            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={sending}>Cancel</Button>
              <Button type="button" onClick={() => void sendTest()} disabled={sending || !subject.trim() || !htmlBody.trim()}>
                {sending && <Loader2 className="h-4 w-4 animate-spin" />}
                Send Test Email
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
