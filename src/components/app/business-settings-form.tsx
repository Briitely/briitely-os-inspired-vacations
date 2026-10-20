"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/core/ui/button";
import { Input } from "@/components/core/ui/input";
import { Label } from "@/components/core/ui/label";
import { SectionIntro as OsSectionIntro, DetailItem } from "@/components/core/workspace-section";
import { Loader2, CheckCircle2, AlertCircle, Pencil } from "lucide-react";
import type { BusinessSettings, RegionalSettings, BrandingSettings } from "@/lib/briitely/client-settings";
import { formatPhoneNumber } from "@/lib/format/phone";
import { orDash } from "@/lib/format/empty";

interface BusinessSettingsFormProps { business: BusinessSettings; regional: RegionalSettings; goLiveDate: string; branding: BrandingSettings; }
type Section = "business" | "branding" | "regional" | "golive" | null;

const TIMEZONE_OPTIONS = [
  ["America/St_Johns", "Newfoundland — St. John's"],
  ["America/Halifax", "Atlantic — Halifax"],
  ["America/Toronto", "Eastern — Toronto"],
  ["America/Winnipeg", "Central — Winnipeg"],
  ["America/Edmonton", "Mountain — Edmonton"],
  ["America/Vancouver", "Pacific — Vancouver"],
  ["America/Los_Angeles", "US Pacific — Los Angeles"],
  ["America/Denver", "US Mountain — Denver"],
  ["America/Chicago", "US Central — Chicago"],
  ["America/New_York", "US Eastern — New York"],
] as const;
const CURRENCY_OPTIONS = [["CAD", "CAD — Canadian Dollar"], ["USD", "USD — US Dollar"]] as const;
const LOCALE_OPTIONS = [["en-CA", "English (Canada)"], ["en-US", "English (United States)"]] as const;

const HEX_PATTERN = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
function normalizeHex(value: string): string { if (!value) return ""; const v = value.startsWith("#") ? value : `#${value}`; if (HEX_PATTERN.test(v) && v.length === 4) { const [_, r, g, b] = v; return `#${r}${r}${g}${g}${b}${b}`; } return v; }
function valueOrNotProvided(value?: string) { return orDash(value); }
function ColorField({ id, label, value, onChange, disabled }: { id: string; label: string; value: string; onChange: (v: string) => void; disabled: boolean }) { const normalized = normalizeHex(value) || "#000000"; return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><div className="flex items-center gap-3"><input type="color" id={`${id}-picker`} value={normalized} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="h-10 w-12 cursor-pointer rounded-md border border-input bg-background p-1"/><Input id={id} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder="#496D35" className="flex-1" /></div></div>; }

// Section intros and details come from the shared Briitely OS layout components.
function SectionIntro({ eyebrow, title, description, editing, onEdit, disabled }: { eyebrow: string; title: string; description: string; editing: boolean; onEdit: () => void; disabled: boolean }) {
  return <OsSectionIntro eyebrow={eyebrow} title={title} description={description} action={<Button type="button" variant="outline" onClick={onEdit} disabled={disabled}><Pencil className="h-4 w-4" />{editing ? "Cancel" : `Edit ${title}`}</Button>} />;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <DetailItem label={label} value={value} />;
}

function ColorDetail({ label, color }: { label: string; color: string }) {
  return <div><p className="detail-label">{label}</p><div className="mt-1 flex items-center gap-2"><span className="h-5 w-5 shrink-0 rounded-full border border-border" style={{ backgroundColor: color }} /><span className="text-sm font-medium text-foreground">{color}</span></div></div>;
}

export function BusinessSettingsForm({ business, regional, goLiveDate: initialGoLiveDate, branding: initialBranding }: BusinessSettingsFormProps) {
  const router = useRouter();
  const [biz, setBiz] = useState(business); const [savedBiz, setSavedBiz] = useState(business);
  const [reg, setReg] = useState(regional); const [savedReg, setSavedReg] = useState(regional);
  const [goLiveDate, setGoLiveDate] = useState(initialGoLiveDate); const [savedGoLiveDate, setSavedGoLiveDate] = useState(initialGoLiveDate);
  const [branding, setBranding] = useState(initialBranding); const [savedBranding, setSavedBranding] = useState(initialBranding);
  const [editing, setEditing] = useState<Section>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null); const [success, setSuccess] = useState(false); const [confirmGoLive, setConfirmGoLive] = useState(false);

  function cancel(section: Section) {
    if (section === "business") setBiz(savedBiz);
    if (section === "branding") setBranding(savedBranding);
    if (section === "regional") setReg(savedReg);
    if (section === "golive") { setGoLiveDate(savedGoLiveDate); setConfirmGoLive(false); }
    setEditing(null); setError(null);
  }
  function toggle(section: Exclude<Section, null>) { if (editing === section) cancel(section); else { setEditing(section); setError(null); } }

  async function saveSettings(key: string, value: unknown, description?: string, requireConfirm = false) {
    setError(null); setSuccess(false);
    if (requireConfirm && !confirmGoLive) { setError("Please confirm the go-live date change by checking the confirmation box below."); return false; }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, value, description, confirmGoLive: requireConfirm }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "We couldn't save the settings. Please try again."); return false; }
      setSuccess(true); setConfirmGoLive(false); setTimeout(() => setSuccess(false), 3000); router.refresh(); return true;
    } catch { setError("Something went wrong. Please try again."); return false; }
    finally { setLoading(false); }
  }

  async function handleBusinessSubmit(e: React.FormEvent) { e.preventDefault(); if (await saveSettings("business", biz, "Business identity and address")) { setSavedBiz(biz); setEditing(null); } }
  async function handleRegionalSubmit(e: React.FormEvent) { e.preventDefault(); if (await saveSettings("regional", reg, "Regional settings: timezone, currency, locale")) { setSavedReg(reg); setEditing(null); } }
  async function handleGoLiveSubmit(e: React.FormEvent) { e.preventDefault(); if (await saveSettings("invoiceGoLiveDate", goLiveDate, "Invoice history start date", true)) { setSavedGoLiveDate(goLiveDate); setEditing(null); } }
  async function handleBrandingSubmit(e: React.FormEvent) { e.preventDefault(); const normalized = { ...branding, primaryColor: normalizeHex(branding.primaryColor), secondaryColor: normalizeHex(branding.secondaryColor), accentColor: normalizeHex(branding.accentColor) }; setBranding(normalized); if (await saveSettings("branding", normalized, "Business branding: logo URL, favicon URL and brand colors")) { setSavedBranding(normalized); setEditing(null); } }

  return <div className="space-y-6">
    {success && <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-4 py-3"><CheckCircle2 className="h-5 w-5 text-green-600" /><p className="text-sm text-green-700">Settings saved successfully.</p></div>}
    {error && <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3"><AlertCircle className="h-5 w-5 text-destructive" /><p className="text-sm text-destructive">{error}</p></div>}

    <section className="os-section"><div className="os-section-grid">
      <SectionIntro eyebrow="Business" title="Business Identity" description="Your company contact and mailing information used throughout the dashboard." editing={editing === "business"} onEdit={() => toggle("business")} disabled={loading} />
      {editing !== "business" ? <div><p className="detail-label border-b border-border pb-2">Business & Address</p><div className="grid gap-x-8 gap-y-5 pt-3 sm:grid-cols-2 lg:grid-cols-3"><Detail label="Business Name" value={valueOrNotProvided(savedBiz.businessName)} /><Detail label="Phone" value={valueOrNotProvided(formatPhoneNumber(savedBiz.phone))} /><Detail label="Website" value={valueOrNotProvided(savedBiz.website)} /><Detail label="Email" value={valueOrNotProvided(savedBiz.email)} /><Detail label="Street Address" value={valueOrNotProvided(savedBiz.address.street)} /><Detail label="City" value={valueOrNotProvided(savedBiz.address.city)} /><Detail label="Province/State" value={valueOrNotProvided(savedBiz.address.province)} /><Detail label="Postal Code" value={valueOrNotProvided(savedBiz.address.postalCode)} /><Detail label="Country" value={valueOrNotProvided(savedBiz.address.country)} /></div></div> : <form onSubmit={handleBusinessSubmit} className="space-y-4"><div className="space-y-2"><Label htmlFor="biz-name">Business Name</Label><Input id="biz-name" value={biz.businessName} onChange={(e) => setBiz({ ...biz, businessName: e.target.value })} disabled={loading} /></div><div className="grid sm:grid-cols-2 gap-4"><div className="space-y-2"><Label htmlFor="biz-phone">Phone</Label><Input id="biz-phone" type="tel" value={biz.phone} onChange={(e) => setBiz({ ...biz, phone: e.target.value })} disabled={loading} /></div><div className="space-y-2"><Label htmlFor="biz-website">Website</Label><Input id="biz-website" value={biz.website} onChange={(e) => setBiz({ ...biz, website: e.target.value })} disabled={loading} /></div></div><div className="space-y-2"><Label htmlFor="biz-email">Email</Label><Input id="biz-email" type="email" value={biz.email} onChange={(e) => setBiz({ ...biz, email: e.target.value })} disabled={loading} /></div><div className="space-y-2"><Label htmlFor="biz-street">Street Address</Label><Input id="biz-street" value={biz.address.street} onChange={(e) => setBiz({ ...biz, address: { ...biz.address, street: e.target.value } })} disabled={loading} /></div><div className="grid grid-cols-2 sm:grid-cols-3 gap-4"><div className="space-y-2"><Label htmlFor="biz-city">City</Label><Input id="biz-city" value={biz.address.city} onChange={(e) => setBiz({ ...biz, address: { ...biz.address, city: e.target.value } })} disabled={loading} /></div><div className="space-y-2"><Label htmlFor="biz-province">Province/State</Label><Input id="biz-province" value={biz.address.province} onChange={(e) => setBiz({ ...biz, address: { ...biz.address, province: e.target.value } })} disabled={loading} /></div><div className="space-y-2"><Label htmlFor="biz-postal">Postal Code</Label><Input id="biz-postal" value={biz.address.postalCode} onChange={(e) => setBiz({ ...biz, address: { ...biz.address, postalCode: e.target.value } })} disabled={loading} /></div></div><div className="space-y-2"><Label htmlFor="biz-country">Country</Label><Input id="biz-country" value={biz.address.country} onChange={(e) => setBiz({ ...biz, address: { ...biz.address, country: e.target.value } })} disabled={loading} /></div><div className="flex justify-end"><Button type="submit" disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" />}Save Business Identity</Button></div></form>}
    </div></section>

    <section className="os-section"><div className="os-section-grid">
      <SectionIntro eyebrow="Brand" title="Branding" description="Control the logo and brand colours used across the application." editing={editing === "branding"} onEdit={() => toggle("branding")} disabled={loading} />
      {editing !== "branding" ? <div className="min-w-0"><p className="detail-label border-b border-border pb-2">Brand Appearance</p><div className="pt-3"><div className="min-w-0"><p className="detail-label">Logo URL</p><p className="mt-1 break-all text-sm font-medium text-foreground">{valueOrNotProvided(savedBranding.logoUrl)}</p></div><div className="mt-4 min-w-0"><p className="detail-label">Favicon</p><div className="mt-1 flex items-center gap-2">{savedBranding.faviconUrl ? <img src={savedBranding.faviconUrl} alt="" className="h-6 w-6 shrink-0 rounded-sm object-contain" /> : null}<p className="break-all text-sm font-medium text-foreground">{valueOrNotProvided(savedBranding.faviconUrl)}</p></div></div><div className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-3"><ColorDetail label="Primary Colour" color={savedBranding.primaryColor} /><ColorDetail label="Secondary Colour" color={savedBranding.secondaryColor} /><ColorDetail label="Accent Colour" color={savedBranding.accentColor} /></div></div></div> : <form onSubmit={handleBrandingSubmit} className="min-w-0 space-y-4"><div className="space-y-2"><Label htmlFor="brand-logo">Logo URL</Label><Input id="brand-logo" value={branding.logoUrl} onChange={(e) => setBranding({ ...branding, logoUrl: e.target.value })} disabled={loading} placeholder="https://..." /><p className="text-xs text-muted-foreground">This logo appears in the application header and invoice print view.</p></div><div className="space-y-2"><Label htmlFor="brand-favicon">Favicon URL</Label><Input id="brand-favicon" value={branding.faviconUrl} onChange={(e) => setBranding({ ...branding, faviconUrl: e.target.value })} disabled={loading} placeholder="https://..." /><p className="text-xs text-muted-foreground">The small icon in the browser tab, so the team can spot the dashboard among their tabs. Use a square PNG, ICO or SVG, at least 32 × 32 pixels.</p></div><div className="grid sm:grid-cols-3 gap-4"><ColorField id="brand-primary" label="Primary Colour" value={branding.primaryColor} onChange={(v) => setBranding({ ...branding, primaryColor: v })} disabled={loading} /><ColorField id="brand-secondary" label="Secondary Colour" value={branding.secondaryColor} onChange={(v) => setBranding({ ...branding, secondaryColor: v })} disabled={loading} /><ColorField id="brand-accent" label="Accent Colour" value={branding.accentColor} onChange={(v) => setBranding({ ...branding, accentColor: v })} disabled={loading} /></div><p className="text-xs text-muted-foreground leading-relaxed">Primary colour controls main buttons and branded accents. Page backgrounds, cards, and text remain neutral for readability.</p><div className="flex justify-end"><Button type="submit" disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" />}Save Branding</Button></div></form>}
    </div></section>

    <section className="os-section"><div className="os-section-grid">
      <SectionIntro eyebrow="Region" title="Regional Settings" description="Set the timezone, currency, and locale used throughout reporting and financial displays." editing={editing === "regional"} onEdit={() => toggle("regional")} disabled={loading} />
      {editing !== "regional" ? <div><p className="detail-label border-b border-border pb-2">Regional Preferences</p><div className="grid gap-x-8 gap-y-5 pt-3 sm:grid-cols-3"><Detail label="Timezone" value={valueOrNotProvided(savedReg.timezone)} /><Detail label="Currency" value={valueOrNotProvided(savedReg.currency)} /><Detail label="Locale" value={valueOrNotProvided(savedReg.locale)} /></div></div> : <form onSubmit={handleRegionalSubmit} className="space-y-4"><div className="grid sm:grid-cols-3 gap-4"><div className="space-y-2"><Label htmlFor="reg-timezone">Timezone</Label><select id="reg-timezone" className="h-12 w-full rounded-md border border-input bg-background px-3 text-sm" value={reg.timezone} onChange={(e) => setReg({ ...reg, timezone: e.target.value })} disabled={loading}>{TIMEZONE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="space-y-2"><Label htmlFor="reg-currency">Currency</Label><select id="reg-currency" className="h-12 w-full rounded-md border border-input bg-background px-3 text-sm" value={reg.currency} onChange={(e) => setReg({ ...reg, currency: e.target.value })} disabled={loading}>{CURRENCY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="space-y-2"><Label htmlFor="reg-locale">Locale</Label><select id="reg-locale" className="h-12 w-full rounded-md border border-input bg-background px-3 text-sm" value={reg.locale} onChange={(e) => setReg({ ...reg, locale: e.target.value })} disabled={loading}>{LOCALE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div></div><p className="text-xs leading-relaxed text-muted-foreground">These settings control date/time display, currency formatting, and number formatting across the app.</p><div className="flex justify-end"><Button type="submit" disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" />}Save Regional Settings</Button></div></form>}
    </div></section>

    <section className="os-section"><div className="os-section-grid">
      <SectionIntro eyebrow="Invoices" title="Invoice History" description="Control the date from which invoices are included in Briitely OS history and reporting." editing={editing === "golive"} onEdit={() => toggle("golive")} disabled={loading} />
      {editing !== "golive" ? <div><p className="detail-label border-b border-border pb-2">Reporting Start Date</p><div className="pt-3"><Detail label="Go-Live Date" value={valueOrNotProvided(savedGoLiveDate)} /><p className="mt-3 max-w-2xl text-sm text-muted-foreground">Invoices before this date are excluded from Briitely OS invoice history and reporting.</p></div></div> : <form onSubmit={handleGoLiveSubmit} className="space-y-4"><div className="space-y-2"><Label htmlFor="golive">Go-Live Date</Label><Input id="golive" type="date" value={goLiveDate} onChange={(e) => setGoLiveDate(e.target.value)} disabled={loading} /><p className="text-xs text-muted-foreground leading-relaxed">Invoices before this date are excluded from Briitely OS invoice history and reporting. Changing this setting can materially affect financial reporting.</p></div><label className="flex items-start gap-2 cursor-pointer"><input type="checkbox" checked={confirmGoLive} onChange={(e) => setConfirmGoLive(e.target.checked)} disabled={loading} className="mt-1" /><span className="text-sm text-muted-foreground">I understand this will change which invoices appear in reporting and agree to proceed.</span></label><div className="flex justify-end"><Button type="submit" disabled={loading || !confirmGoLive} variant={confirmGoLive ? "default" : "outline"}>{loading && <Loader2 className="h-4 w-4 animate-spin" />}Save Go-Live Date</Button></div></form>}
    </div></section>
  </div>;
}
