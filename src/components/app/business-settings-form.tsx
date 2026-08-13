"use client";

import { useState } from "react";
import { Button } from "@/components/core/ui/button";
import { Input } from "@/components/core/ui/input";
import { Label } from "@/components/core/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/core/ui/card";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import type { BusinessSettings, RegionalSettings, BrandingSettings } from "@/lib/briitely/client-settings";

interface BusinessSettingsFormProps {
  business: BusinessSettings;
  regional: RegionalSettings;
  goLiveDate: string;
  branding: BrandingSettings;
}

const HEX_PATTERN = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

function normalizeHex(value: string): string {
  if (!value) return "";
  const v = value.startsWith("#") ? value : `#${value}`;
  if (HEX_PATTERN.test(v) && v.length === 4) {
    const [_, r, g, b] = v;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return v;
}

function ColorField({ id, label, value, onChange, disabled }: { id: string; label: string; value: string; onChange: (v: string) => void; disabled: boolean }) {
  const normalized = normalizeHex(value) || "#000000";
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          id={`${id}-picker`}
          value={normalized}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-10 w-12 cursor-pointer rounded-md border border-input bg-background p-1"
        />
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="#496D35"
          className="flex-1"
        />
      </div>
    </div>
  );
}

export function BusinessSettingsForm({ business, regional, goLiveDate: initialGoLiveDate, branding: initialBranding }: BusinessSettingsFormProps) {
  const [biz, setBiz] = useState(business);
  const [reg, setReg] = useState(regional);
  const [goLiveDate, setGoLiveDate] = useState(initialGoLiveDate);
  const [branding, setBranding] = useState(initialBranding);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [confirmGoLive, setConfirmGoLive] = useState(false);

  async function saveSettings(key: string, value: unknown, description?: string, requireConfirm = false) {
    setError(null);
    setSuccess(false);

    if (requireConfirm && !confirmGoLive) {
      setError("Please confirm the go-live date change by checking the confirmation box below.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value, description, confirmGoLive: requireConfirm }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "We couldn't save the settings. Please try again.");
        return;
      }

      setSuccess(true);
      setConfirmGoLive(false);
      setTimeout(() => setSuccess(false), 3000);

      if (key === "branding") {
        window.location.reload();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleBusinessSubmit(e: React.FormEvent) {
    e.preventDefault();
    await saveSettings("business", biz, "Business identity and address");
  }

  async function handleRegionalSubmit(e: React.FormEvent) {
    e.preventDefault();
    await saveSettings("regional", reg, "Regional settings: timezone, currency, locale");
  }

  async function handleGoLiveSubmit(e: React.FormEvent) {
    e.preventDefault();
    await saveSettings("invoiceGoLiveDate", goLiveDate, "Invoice history start date", true);
  }

  async function handleBrandingSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalized = {
      ...branding,
      primaryColor: normalizeHex(branding.primaryColor),
      secondaryColor: normalizeHex(branding.secondaryColor),
      accentColor: normalizeHex(branding.accentColor),
    };
    setBranding(normalized);
    await saveSettings("branding", normalized, "Business branding: logo URL and brand colors");
  }

  return (
    <div className="space-y-6">
      {success && (
        <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <p className="text-sm text-green-700">Settings saved successfully.</p>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-lg">Business Identity</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleBusinessSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="biz-name">Business Name</Label>
              <Input id="biz-name" value={biz.businessName} onChange={(e) => setBiz({ ...biz, businessName: e.target.value })} disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="biz-logo">Logo URL</Label>
              <Input id="biz-logo" value={biz.logoUrl} onChange={(e) => setBiz({ ...biz, logoUrl: e.target.value })} disabled={loading} placeholder="https://..." />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="biz-phone">Phone</Label>
                <Input id="biz-phone" value={biz.phone} onChange={(e) => setBiz({ ...biz, phone: e.target.value })} disabled={loading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="biz-website">Website</Label>
                <Input id="biz-website" value={biz.website} onChange={(e) => setBiz({ ...biz, website: e.target.value })} disabled={loading} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="biz-email">Email</Label>
              <Input id="biz-email" type="email" value={biz.email} onChange={(e) => setBiz({ ...biz, email: e.target.value })} disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="biz-street">Street Address</Label>
              <Input id="biz-street" value={biz.address.street} onChange={(e) => setBiz({ ...biz, address: { ...biz.address, street: e.target.value } })} disabled={loading} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="biz-city">City</Label>
                <Input id="biz-city" value={biz.address.city} onChange={(e) => setBiz({ ...biz, address: { ...biz.address, city: e.target.value } })} disabled={loading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="biz-province">Province/State</Label>
                <Input id="biz-province" value={biz.address.province} onChange={(e) => setBiz({ ...biz, address: { ...biz.address, province: e.target.value } })} disabled={loading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="biz-postal">Postal Code</Label>
                <Input id="biz-postal" value={biz.address.postalCode} onChange={(e) => setBiz({ ...biz, address: { ...biz.address, postalCode: e.target.value } })} disabled={loading} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="biz-country">Country</Label>
              <Input id="biz-country" value={biz.address.country} onChange={(e) => setBiz({ ...biz, address: { ...biz.address, country: e.target.value } })} disabled={loading} />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Business Identity
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Branding</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleBrandingSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="brand-logo">Logo URL</Label>
              <Input id="brand-logo" value={branding.logoUrl} onChange={(e) => setBranding({ ...branding, logoUrl: e.target.value })} disabled={loading} placeholder="https://..." />
              <p className="text-xs text-muted-foreground">This logo appears in the application header and invoice print view.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <ColorField id="brand-primary" label="Primary Colour" value={branding.primaryColor} onChange={(v) => setBranding({ ...branding, primaryColor: v })} disabled={loading} />
              <ColorField id="brand-secondary" label="Secondary Colour" value={branding.secondaryColor} onChange={(v) => setBranding({ ...branding, secondaryColor: v })} disabled={loading} />
              <ColorField id="brand-accent" label="Accent Colour" value={branding.accentColor} onChange={(v) => setBranding({ ...branding, accentColor: v })} disabled={loading} />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Primary colour controls main buttons and branded accents. Page backgrounds, cards, and text remain neutral for readability.
            </p>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Branding
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Regional Settings</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleRegionalSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="reg-timezone">Timezone</Label>
                <Input id="reg-timezone" value={reg.timezone} onChange={(e) => setReg({ ...reg, timezone: e.target.value })} disabled={loading} placeholder="America/Edmonton" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-currency">Currency</Label>
                <Input id="reg-currency" value={reg.currency} onChange={(e) => setReg({ ...reg, currency: e.target.value })} disabled={loading} placeholder="CAD" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-locale">Locale</Label>
                <Input id="reg-locale" value={reg.locale} onChange={(e) => setReg({ ...reg, locale: e.target.value })} disabled={loading} placeholder="en-CA" />
              </div>
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Regional Settings
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Invoice History Start Date</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleGoLiveSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="golive">Go-Live Date</Label>
              <Input id="golive" type="date" value={goLiveDate} onChange={(e) => setGoLiveDate(e.target.value)} disabled={loading} />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Invoices before this date are excluded from Briitely OS invoice history and reporting.
                Changing this setting can materially affect financial reporting.
              </p>
            </div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmGoLive}
                onChange={(e) => setConfirmGoLive(e.target.checked)}
                disabled={loading}
                className="mt-1"
              />
              <span className="text-sm text-muted-foreground">
                I understand this will change which invoices appear in reporting and agree to proceed.
              </span>
            </label>
            <Button type="submit" disabled={loading || !confirmGoLive} variant={confirmGoLive ? "default" : "outline"}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Go-Live Date
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
