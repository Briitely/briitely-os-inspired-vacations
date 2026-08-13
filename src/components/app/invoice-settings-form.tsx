"use client";

import { useState } from "react";
import { Button } from "@/components/core/ui/button";
import { Input } from "@/components/core/ui/input";
import { Label } from "@/components/core/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/core/ui/card";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import type { InvoiceSettings } from "@/lib/briitely/client-settings";
import type { BriitelyUserOption } from "@/lib/briitely/users";

interface InvoiceSettingsFormProps {
  invoice: InvoiceSettings;
  ghlOptions: BriitelyUserOption[];
}

export function InvoiceSettingsForm({ invoice, ghlOptions }: InvoiceSettingsFormProps) {
  const [settings, setSettings] = useState(invoice);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "invoice", value: settings, description: "Invoice and payment settings" }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "We couldn't save the settings. Please try again.");
        return;
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {success && (
        <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <p className="text-sm text-green-700">Invoice settings saved successfully.</p>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-lg">Payment Instructions</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inv-payment">Payment Instructions</Label>
              <textarea
                id="inv-payment"
                value={settings.paymentInstructions}
                onChange={(e) => setSettings({ ...settings, paymentInstructions: e.target.value })}
                disabled={loading}
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
              <p className="text-xs text-muted-foreground">Shown on invoices to tell customers how to pay.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-late">Late Payment Terms</Label>
              <textarea
                id="inv-late"
                value={settings.latePaymentTerms}
                onChange={(e) => setSettings({ ...settings, latePaymentTerms: e.target.value })}
                disabled={loading}
                rows={2}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-sender">Default Invoice Sender</Label>
              <select
                id="inv-sender"
                value={settings.defaultSenderUserId}
                onChange={(e) => {
                  const selected = ghlOptions.find((u) => u.id === e.target.value);
                  setSettings({
                    ...settings,
                    defaultSenderUserId: e.target.value,
                    defaultSenderEmail: selected?.label ?? "",
                  });
                }}
                disabled={loading}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {ghlOptions.map((u) => (
                  <option key={u.id} value={u.id}>{u.label}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Used when no specific user is assigned to an invoice. The assigned user takes priority.
              </p>
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Invoice Settings
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
