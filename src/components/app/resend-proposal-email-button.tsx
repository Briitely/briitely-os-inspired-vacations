"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Bold, Italic, Link as LinkIcon, Mail, Loader2, Send, X } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { RevisionSummary } from "@/components/app/revision-summary";

const first = (value: string) => value.trim().split(/\s+/)[0] || "there";
const advisorFirst = (value: string) => value.trim().split(/\s+/)[0] || "Your Inspired Vacations Advisor";

function emailHtml(name: string, url: string, advisor: string) {
  return `<div>Hi ${first(name)},</div><div><br></div><div>Just a quick follow-up — we're resending the link to your personalized travel proposal so it's easy to find.</div><div><br></div><div>👉 <a href="${url}" style="text-decoration: underline;">View Your Custom Trip Proposal</a></div><div><br></div><div>Take your time to explore it, and if you have any questions, want to tweak something, or just want to chat about your options, we're here and happy to help. Just hit reply on this email and we'll get back to you! 🌺</div><div><br></div><div>Cheers,</div><div><br></div><div>${advisorFirst(advisor)} &amp; the Inspired Vacations Team ✈️</div>`;
}

export function ResendProposalEmailButton({ travelFileId }: { travelFileId: string }) {
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [revisionMount, setRevisionMount] = useState<HTMLElement | null>(null);
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState("🌴 Your Custom Trip Proposal is Ready! ✈️");
  const [html, setHtml] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/travel-files/${travelFileId}/proposal-send`)
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        setData(d);
        setAvailable(Boolean(d.travefyProposalUrl && d.email));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [travelFileId]);

  useEffect(() => {
    let mount: HTMLElement | null = null;
    let timer: number | undefined;
    let attempts = 0;
    const place = () => {
      attempts++;
      const panels = [...document.querySelectorAll("main > div")];
      const booking = panels.find(
        (el) =>
          el.textContent?.toLowerCase().includes("booking & planning") &&
          el.textContent?.toLowerCase().includes("booking information"),
      ) as HTMLElement | undefined;
      if (booking) {
        const labels = [...booking.querySelectorAll("div")];
        const bookingNumberLabel = labels.find(
          (el) => el.textContent?.trim().toLowerCase() === "booking number",
        ) as HTMLElement | undefined;
        const infoBlock = bookingNumberLabel?.parentElement as HTMLElement | null;
        if (infoBlock?.parentElement) {
          mount = document.createElement("div");
          infoBlock.parentElement.insertBefore(mount, infoBlock.nextSibling);
          setRevisionMount(mount);
          return;
        }
      }
      if (attempts < 20) timer = window.setTimeout(place, 100);
    };
    place();
    return () => {
      if (timer) window.clearTimeout(timer);
      mount?.remove();
    };
  }, [travelFileId]);

  function openEditor() {
    setError(null);
    setHtml(
      emailHtml(
        data.clientName ?? data.firstName ?? "Client",
        data.travefyProposalUrl,
        data.assignedAdvisorName ?? "Your Inspired Vacations Advisor",
      ),
    );
    setEditing(true);
  }

  function sync() {
    const el = document.getElementById("proposal-resend-editor") as HTMLElement | null;
    if (el) setHtml(el.innerHTML);
  }

  function format(cmd: string, value?: string) {
    document.execCommand(cmd, false, value);
    sync();
  }

  async function send() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/travel-files/${travelFileId}/send-client-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailType: "proposal_resend",
          recipientName: data.clientName ?? data.firstName ?? "Client",
          recipientEmail: data.email,
          subject,
          htmlBody: html,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Could not resend proposal email through Briitely.");
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not resend proposal email.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {available && (
        <div className="space-y-1">
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={openEditor}>
            <Mail className="h-4 w-4" />
            Resend Proposal Email
          </Button>
          {error && !editing && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}

      {revisionMount && createPortal(<RevisionSummary travelFileId={travelFileId} />, revisionMount)}

      {editing &&
        createPortal(
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-2xl rounded-lg bg-background shadow-xl">
              <div className="flex items-center border-b px-6 py-5">
                <h2 className="text-lg font-semibold">Resend Proposal Email</h2>
                <button
                  className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                  onClick={() => setEditing(false)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4 p-5">
                <div>
                  <span className="text-xs text-muted-foreground">To</span>
                  <p className="text-sm font-medium">
                    {data.clientName ?? data.firstName} &lt;{data.email}&gt;
                  </p>
                </div>

                <label className="block text-sm font-medium">
                  Subject
                  <input
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </label>

                <div>
                  <div className="mb-1 text-sm font-medium">Message</div>
                  <div className="flex gap-1 rounded-t-md border border-b-0 p-1">
                    <Button type="button" size="sm" variant="ghost" onMouseDown={(e) => e.preventDefault()} onClick={() => format("bold")}>
                      <Bold className="h-4 w-4" />
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onMouseDown={(e) => e.preventDefault()} onClick={() => format("italic")}>
                      <Italic className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        const url = window.prompt("Link URL", data.travefyProposalUrl);
                        if (url) format("createLink", url);
                      }}
                    >
                      <LinkIcon className="h-4 w-4" />
                    </Button>
                  </div>
                  <div
                    id="proposal-resend-editor"
                    className="min-h-64 rounded-b-md border bg-background p-3 text-sm leading-5 outline-none [&_a]:text-primary [&_a]:underline"
                    contentEditable
                    suppressContentEditableWarning
                    dangerouslySetInnerHTML={{ __html: html }}
                    onInput={(e) => setHtml(e.currentTarget.innerHTML)}
                  />
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={send} disabled={loading || !subject.trim() || !html.trim()}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Send through Briitely
                  </Button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
