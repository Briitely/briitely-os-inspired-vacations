"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Bold,
  Check,
  CheckCircle2,
  Copy,
  Italic,
  Link as LinkIcon,
  Loader2,
  Mail,
  Send,
  X,
} from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/core/ui/card";

type Profile = {
  briitely_contact_id?: string | null;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  email: string | null;
};

type PartyMember = {
  id: string;
  traveller_role: string;
  booking_form_recipient_party_member_id: string | null;
  booking_form_completed_at: string | null;
  traveller_profiles: Profile | Profile[];
};

type ResendDetails = {
  clientName: string;
  email: string;
  destination: string | null;
  assignedAdvisorName: string | null;
};

type Draft = {
  recipientName: string;
  recipientEmail: string;
  recipientContactId: string | null;
  subject: string;
  html: string;
  secureUrl: string;
  partyMemberId?: string;
  isPrimary: boolean;
};

function profile(member: PartyMember) {
  return Array.isArray(member.traveller_profiles)
    ? member.traveller_profiles[0]
    : member.traveller_profiles;
}

function fullName(member: PartyMember) {
  const p = profile(member);
  return [p?.preferred_name || p?.first_name, p?.last_name].filter(Boolean).join(" ");
}

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] || "there";
}

function signoff(advisorName: string | null) {
  return advisorName?.trim()?.split(/\s+/)[0] || "the Inspired Vacations Team";
}

function originalBookingHtml(
  recipientName: string,
  url: string,
  advisorName: string | null,
  destination: string | null,
  primaryName: string,
  isPrimary: boolean,
) {
  const where = destination?.trim() || "your upcoming trip";
  const intro = isPrimary
    ? `We're excited to start planning your trip to ${where}. Before we can get started, please take a few minutes to complete your Client Booking Form using the link below.`
    : `We're excited to book this trip to ${where} for you and ${firstName(primaryName)}! Before we can get started, please take a few minutes to complete your Client Booking Form using the link below.`;

  return `<div>Hi ${firstName(recipientName)},</div><div><br></div><div>${intro}</div><div><br></div><div>👉 <a href="${url}" style="text-decoration: underline;">Complete Booking Form</a></div><div><br></div><div>What's included:</div><div>• Personal and passport details</div><div>• Special considerations</div><div>• Emergency contact information</div><div><br></div><div>If you have any questions, just hit reply — we're always happy to help. 😊</div><div><br></div><div>Cheers,</div><div>${signoff(advisorName)} &amp; the Inspired Vacations Team 🌺</div>`;
}

function reminderBookingHtml(
  recipientName: string,
  url: string,
  advisorName: string | null,
) {
  return `<div>Hi ${firstName(recipientName)},</div><div><br></div><div>We haven't received your completed booking form yet, so here's a fresh link to make it easy.</div><div><br></div><div>👉 <a href="${url}" style="text-decoration: underline;">Complete Booking Form</a></div><div><br></div><div>If you've already completed it, you can disregard this message. If you have any questions, just hit reply — we're always happy to help. 😊</div><div><br></div><div>Cheers,</div><div>${signoff(advisorName)} &amp; the Inspired Vacations Team 🌺</div>`;
}

function applyReminderTemplate(template:{subject:string;body_html:string}|null,recipientName:string,url:string,advisorName:string|null,destination:string|null,primaryName:string){
  if(!template)return null;
  const first=firstName(recipientName),advisor=signoff(advisorName),primaryFirst=firstName(primaryName);
  const replace=(value:string)=>value.replaceAll("{{first_name}}",first).replaceAll("{{destination}}",destination?.trim()||"your upcoming trip").replaceAll("{{advisor_first_name}}",advisor).replaceAll("{{primary_first_name}}",primaryFirst).replaceAll("{{secure_form_url}}",url);
  return{subject:replace(template.subject),html:replace(template.body_html)};
}

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: response.ok ? "The server returned an invalid response." : `Request failed (${response.status}).` };
  }
}

export function TravelPartyResendBookingFormsModal({
  travelFileId,
  isOpen,
  onClose,
}: {
  travelFileId: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [party, setParty] = useState<PartyMember[]>([]);
  const [details, setDetails] = useState<ResendDetails | null>(null);
  const [primaryPrepared, setPrimaryPrepared] = useState(false);
  const [preparedRecipientIds, setPreparedRecipientIds] = useState<string[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [copied, setCopied] = useState(false);\n  const [reminderTemplate, setReminderTemplate] = useState<{subject:string;body_html:string}|null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setDraft(null);
    setCopied(false);

    Promise.all([
      fetch(`/api/travel-files/${encodeURIComponent(travelFileId)}/travellers`).then(readJson),
      fetch(`/api/travel-files/${encodeURIComponent(travelFileId)}/booking-form-status`).then(readJson),
      fetch(`/api/travel-files/${encodeURIComponent(travelFileId)}/current-action`).then(readJson),\n      fetch(`/api/email-templates/booking-form-reminder`).then(readJson),
    ])
      .then(([partyData, statusData, actionData, templateData]) => {
        setParty(partyData.party ?? []);
        setPrimaryPrepared(Boolean(statusData.primaryPrepared || statusData.primaryBookingPrepared));
        setPreparedRecipientIds(statusData.preparedRecipientIds ?? []);
        setDetails(actionData?.resendForms ?? null);\n        setReminderTemplate(templateData?.template ?? null);
      })
      .catch(() => setError("Could not load the booking form details."));
  }, [isOpen, travelFileId]);

  const primary = party.find((member) => member.traveller_role === "primary");
  const primaryProfile = primary ? profile(primary) : null;
  const primaryName = primary ? fullName(primary) : details?.clientName || "Primary traveller";

  const groups = useMemo(() => {
    const recipientIds = Array.from(
      new Set(
        party
          .map((member) => member.booking_form_recipient_party_member_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    return recipientIds
      .map((id) => {
        const recipient = party.find((member) => member.id === id);
        if (!recipient || recipient.id === primary?.id) return null;
        return {
          id,
          recipient,
          members: party.filter(
            (member) => member.id === id || member.booking_form_recipient_party_member_id === id,
          ),
        };
      })
      .filter((group): group is NonNullable<typeof group> => Boolean(group));
  }, [party, primary?.id]);

  async function preparePrimary() {
    if (!primary || !primaryProfile) {
      setError("The primary traveller could not be loaded.");
      return;
    }

    setWorking(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/travel-files/${encodeURIComponent(travelFileId)}/booking-form-link`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error ?? "Could not prepare the booking form.");

      const alreadyPrepared = primaryPrepared;
      setDraft({
        recipientName: primaryName,
        recipientEmail: primaryProfile.email ?? details?.email ?? "",
        recipientContactId: primaryProfile.briitely_contact_id ?? null,
        subject: alreadyPrepared
          ? "Reminder: Your Client Booking Form - Inspired Vacations"
          : "Your Client Booking Form - Inspired Vacations",
        html: alreadyPrepared
          ? reminderBookingHtml(primaryName, data.url, details?.assignedAdvisorName ?? null)
          : originalBookingHtml(
              primaryName,
              data.url,
              details?.assignedAdvisorName ?? null,
              details?.destination ?? null,
              primaryName,
              true,
            ),
        secureUrl: data.url,
        isPrimary: true,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not prepare the booking form.");
    } finally {
      setWorking(false);
    }
  }

  async function prepareGroup(group: (typeof groups)[number]) {
    setWorking(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/travel-files/${encodeURIComponent(travelFileId)}/booking-form-link`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ partyMemberId: group.id }),
        },
      );
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error ?? "Could not prepare the booking form.");

      const recipientProfile = profile(group.recipient);
      const recipientName = fullName(group.recipient);
      const alreadyPrepared = preparedRecipientIds.includes(group.id);
      const where = details?.destination?.trim() || "Upcoming";

      setDraft({
        recipientName,
        recipientEmail: recipientProfile?.email ?? "",
        recipientContactId: recipientProfile?.briitely_contact_id ?? null,
        partyMemberId: group.id,
        subject: alreadyPrepared
          ? `Reminder: Your Booking Form for Your ${where} Trip`
          : `Your Booking Form for Your ${where} Trip with ${firstName(primaryName)}`,
        html: alreadyPrepared
          ? reminderBookingHtml(recipientName, data.url, details?.assignedAdvisorName ?? null)
          : originalBookingHtml(
              recipientName,
              data.url,
              details?.assignedAdvisorName ?? null,
              details?.destination ?? null,
              primaryName,
              false,
            ),
        secureUrl: data.url,
        isPrimary: false,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not prepare the booking form.");
    } finally {
      setWorking(false);
    }
  }

  async function sendDraft() {
    if (!draft) return;
    setWorking(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/travel-files/${encodeURIComponent(travelFileId)}/send-client-email`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            emailType: "booking_form",
            recipientContactId: draft.recipientContactId,
            recipientName: draft.recipientName,
            recipientEmail: draft.recipientEmail,
            subject: draft.subject,
            htmlBody: draft.html,
          }),
        },
      );
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error ?? "Could not send email through Briitely.");

      if (draft.isPrimary) {
        setPrimaryPrepared(true);
      } else if (draft.partyMemberId) {
        setPreparedRecipientIds((current) =>
          current.includes(draft.partyMemberId!) ? current : [...current, draft.partyMemberId!],
        );
      }
      setDraft(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send email through Briitely.");
    } finally {
      setWorking(false);
    }
  }

  async function copyLink() {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft.secureUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy the secure link. Please try again.");
    }
  }

  function syncEditor() {
    const editor = document.getElementById("iv-travel-party-email-editor") as HTMLElement | null;
    if (editor) setDraft((current) => (current ? { ...current, html: editor.innerHTML } : current));
  }

  function format(command: string, value?: string) {
    document.execCommand(command, false, value);
    syncEditor();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="flex max-h-[90vh] w-full max-w-2xl flex-col">
        <CardHeader className="flex-row justify-between border-b">
          <CardTitle>Resend Forms</CardTitle>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </CardHeader>

        <CardContent className="flex-1 space-y-3 overflow-y-auto p-6">
          {primary && (
            <div className="rounded-md border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <b className="text-sm">Send to {primaryName}</b>
                  <p className="text-xs text-muted-foreground">Booking form only · Primary traveller</p>
                </div>
                <Button
                  size="sm"
                  variant={primaryPrepared ? "outline" : "secondary"}
                  onClick={preparePrimary}
                  disabled={working}
                >
                  <Mail className="h-4 w-4" />
                  {primaryPrepared ? "Send Again" : "Prepare Booking Form"}
                </Button>
              </div>
            </div>
          )}

          {groups.map((group) => {
            const complete = group.members.every((member) => member.booking_form_completed_at);
            const alreadyPrepared = preparedRecipientIds.includes(group.id);
            return (
              <div key={group.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <b className="text-sm">Send to {fullName(group.recipient)}</b>
                    <p className="text-xs text-muted-foreground">
                      Booking form only · Includes: {group.members.map(fullName).join(", ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {complete && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4" />
                        Complete
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant={alreadyPrepared || complete ? "outline" : "secondary"}
                      onClick={() => prepareGroup(group)}
                      disabled={working}
                    >
                      <Send className="h-4 w-4" />
                      {alreadyPrepared ? "Send Again" : "Prepare Booking Form"}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}

          {!primary && !groups.length && !error && (
            <p className="text-sm text-muted-foreground">No booking form recipients were found.</p>
          )}

          {error && (
            <div className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
        </CardContent>

        <div className="flex justify-end gap-2 border-t p-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </Card>

      {draft && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <Card className="flex max-h-[92vh] w-full max-w-2xl flex-col">
            <CardHeader className="flex-row justify-between border-b">
              <CardTitle>Edit Email</CardTitle>
              <button type="button" onClick={() => setDraft(null)} aria-label="Close email editor">
                <X className="h-5 w-5" />
              </button>
            </CardHeader>

            <CardContent className="flex-1 space-y-4 overflow-y-auto p-6">
              <div>
                <span className="text-xs text-muted-foreground">To</span>
                <p className="text-sm font-medium">
                  {draft.recipientName} &lt;{draft.recipientEmail}&gt;
                </p>
              </div>

              <label className="block text-sm font-medium">
                Subject
                <input
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={draft.subject}
                  onChange={(event) => setDraft({ ...draft, subject: event.target.value })}
                />
              </label>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">Message</span>
                  <Button type="button" size="sm" variant="outline" onClick={copyLink}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copied" : "Copy Booking Form Link"}
                  </Button>
                </div>

                <div className="mt-1 flex gap-1 rounded-t-md border border-b-0 p-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => format("bold")}
                  >
                    <Bold className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => format("italic")}
                  >
                    <Italic className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      const url = window.prompt("Link URL", draft.secureUrl);
                      if (url) format("createLink", url);
                    }}
                  >
                    <LinkIcon className="h-4 w-4" />
                  </Button>
                </div>

                <div
                  id="iv-travel-party-email-editor"
                  className="min-h-56 whitespace-normal rounded-b-md border bg-background p-3 text-sm leading-5 outline-none [&_a]:text-primary [&_a]:underline [&_div]:m-0 [&_p]:m-0"
                  contentEditable
                  suppressContentEditableWarning
                  dangerouslySetInnerHTML={{ __html: draft.html }}
                  onInput={(event) => setDraft({ ...draft, html: event.currentTarget.innerHTML })}
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setDraft(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={sendDraft}
                  disabled={working || !draft.subject.trim() || !draft.html.trim()}
                >
                  {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send through Briitely
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
