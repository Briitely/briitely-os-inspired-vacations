"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X, FileText, AlertCircle } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/core/ui/card";
import { Badge } from "@/components/core/ui/badge";
import { formatPhoneNumber } from "@/lib/format/phone";

interface SendTmfModalProps {
  travelFileId: string;
  clientName: string;
  email: string;
  phone: string;
  destination: string | null;
  assignedAdvisorName: string | null;
  agreementType: string | null;
  tmfAmount: number | null;
  revisionsIncluded: number | null;
  agreementDate: string;
  isOpen: boolean;
  onClose: () => void;
}

export function SendTmfModal({ travelFileId, clientName, email, phone, destination, assignedAdvisorName, agreementType, tmfAmount, revisionsIncluded, agreementDate, isOpen, onClose }: SendTmfModalProps) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendBookingForm, setSendBookingForm] = useState<boolean | null>(null);

  if (!isOpen) return null;

  const isIvt = agreementType === "ivt";
  const agreementLabel = agreementType === "all_inclusive" ? "All-Inclusive" : "IVT";

  async function handleSend() {
    if (sendBookingForm === null) {
      setError("Please choose whether to send the Client Booking Form with this agreement.");
      return;
    }

    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/travel-files/${travelFileId}/send-tmf-agreement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendBookingForm }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to send TMF Agreement."); setSending(false); return; }
      if (data.result === "already_sent") { setError("This TMF Agreement has already been sent."); setSending(false); return; }
      onClose();
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setSending(false);
    } finally {
      setSending(false);
    }
  }

  function handleClose() {
    if (sending) return;
    setError(null);
    setSendBookingForm(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
        <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-border">
          <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />Send TMF Agreement</CardTitle>
          <button type="button" onClick={handleClose} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Close"><X className="h-5 w-5" /></button>
        </CardHeader>
        <CardContent className="space-y-5 overflow-y-auto flex-1 p-6">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/30">
            <p className="text-sm text-blue-800 dark:text-blue-200">Review the agreement details below. If anything is incorrect, close this dialog and edit the Travel File first. Clicking Send will deliver the agreement to the client via Briitely.</p>
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Agreement Details</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <ReviewField label="Client Name" value={clientName} />
              <ReviewField label="Email" value={email} />
              <ReviewField label="Phone" value={formatPhoneNumber(phone)} />
              <ReviewField label="Destination" value={destination ?? "—"} />
              <ReviewField label="Assigned Advisor" value={assignedAdvisorName ?? "Unassigned"} />
              <ReviewField label="Agreement Type" value={agreementLabel} />
              <ReviewField label="TMF Amount" value={tmfAmount != null ? `$${tmfAmount.toFixed(2)}` : "—"} />
              <ReviewField label="Agreement Date" value={agreementDate} />
              {isIvt && <ReviewField label="Revisions Included" value={revisionsIncluded != null ? String(revisionsIncluded) : "—"} />}
            </div>
          </div>

          <fieldset className="space-y-2 rounded-lg border border-border p-4">
            <legend className="px-1 text-sm font-semibold text-foreground">Send Client Booking Form with this agreement? *</legend>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="radio" name="sendBookingForm" checked={sendBookingForm === true} onChange={() => setSendBookingForm(true)} disabled={sending} />
                Yes
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="radio" name="sendBookingForm" checked={sendBookingForm === false} onChange={() => setSendBookingForm(false)} disabled={sending} />
                No
              </label>
            </div>
            <p className="text-xs text-muted-foreground">Choose Yes when the client should complete or refresh their booking details for this trip.</p>
          </fieldset>

          <div className="flex items-center gap-2">
            <Badge variant="outline">{agreementLabel} Template</Badge>
            <span className="text-xs text-muted-foreground">The correct Briitely template will be selected automatically based on the agreement type.</span>
          </div>
          {error && <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3"><AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" /><p className="text-sm text-destructive">{error}</p></div>}
        </CardContent>
        <div className="flex justify-end gap-3 border-t border-border p-4">
          <Button type="button" variant="outline" onClick={handleClose} disabled={sending}>Cancel</Button>
          <Button type="button" onClick={handleSend} disabled={sending || sendBookingForm === null}>{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{sending ? "Sending..." : "Send Agreement"}</Button>
        </div>
      </Card>
    </div>
  );
}

function ReviewField({ label, value }: { label: string; value: string }) {
  return <div className="space-y-0.5"><span className="text-xs text-muted-foreground">{label}</span><p className="text-sm font-medium text-foreground">{value}</p></div>;
}
