"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { Card } from "@/components/core/ui/card";
import { Button } from "@/components/core/ui/button";
import { Input } from "@/components/core/ui/input";
import { formatDateOnly } from "@/lib/format/date";
import { formatPhoneNumber } from "@/lib/format/phone";
import { orDash } from "@/lib/format/empty";

/**
 * More Details on the customer file: the client's own Briitely custom fields,
 * picked in Business Settings → Customer File Fields. Staff can edit them here
 * and the change saves to the contact in Briitely.
 */

interface Field { id: string; name: string; dataType: string; options: string[]; value: string | string[]; editable: boolean }
type Values = Record<string, string | string[]>;

const MULTI = new Set(["MULTIPLE_OPTIONS", "CHECKBOX"]);
const NUMBER = new Set(["NUMERICAL", "FLOAT", "MONETORY"]);
const SELECT_CLASSES = "h-12 w-full rounded-md border border-input bg-background px-3 text-base";

function shown(field: Field) {
  if (Array.isArray(field.value)) return orDash(field.value.join(", "));
  if (field.dataType === "DATE") return field.value ? formatDateOnly(field.value) : "—";
  if (field.dataType === "PHONE") return orDash(formatPhoneNumber(field.value));
  return orDash(field.value);
}

function FieldInput({ field, value, onChange, disabled }: { field: Field; value: string | string[]; onChange: (value: string | string[]) => void; disabled: boolean }) {
  const id = `more-${field.id}`;
  if (MULTI.has(field.dataType)) {
    const chosen = Array.isArray(value) ? value : [];
    return <fieldset className="space-y-2"><legend className="detail-label">{field.name}</legend><div className="flex flex-wrap gap-x-5 gap-y-2">{field.options.map((option) => <label key={option} className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={chosen.includes(option)} disabled={disabled} onChange={(e) => onChange(e.target.checked ? [...chosen, option] : chosen.filter((item) => item !== option))} />{option}</label>)}</div></fieldset>;
  }
  const text = typeof value === "string" ? value : "";
  let control;
  if (field.dataType === "SINGLE_OPTIONS" || field.dataType === "RADIO") {
    control = <select id={id} className={SELECT_CLASSES} value={text} disabled={disabled} onChange={(e) => onChange(e.target.value)}><option value="">—</option>{field.options.map((option) => <option key={option}>{option}</option>)}{text && !field.options.includes(text) && <option>{text}</option>}</select>;
  } else if (field.dataType === "LARGE_TEXT") {
    control = <textarea id={id} rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-base" value={text} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
  } else {
    const type = field.dataType === "DATE" ? "date" : field.dataType === "PHONE" ? "tel" : NUMBER.has(field.dataType) ? "number" : "text";
    control = <Input id={id} type={type} step={type === "number" ? "any" : undefined} value={text} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
  }
  return <div className="space-y-1"><label htmlFor={id} className="detail-label">{field.name}</label>{control}</div>;
}

export function CustomerMoreDetailsCard({ customerId }: { customerId: string }) {
  const [fields, setFields] = useState<Field[] | null>(null);
  const [values, setValues] = useState<Values>({});
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const url = `/api/customers/${encodeURIComponent(customerId)}/custom-fields`;

  function apply(next: Field[]) { setFields(next); setValues(Object.fromEntries(next.map((field) => [field.id, field.value]))); }

  useEffect(() => {
    fetch(url, { cache: "no-store" })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); apply(data.fields ?? []); })
      .catch((e) => { setFields([]); setError(e instanceof Error && e.message ? e.message : "More details could not be loaded."); });
  }, [url]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true); setError("");
    try {
      const editable = Object.fromEntries((fields ?? []).filter((field) => field.editable).map((field) => [field.id, values[field.id]]));
      const response = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ values: editable }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "We couldn't save the details. Please try again.");
      apply(data.fields ?? []); setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't save the details. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function cancel() { if (fields) apply(fields); setEditing(false); setError(""); }

  if (fields && !fields.length && !error) return null;
  const canEdit = Boolean(fields?.some((field) => field.editable));
  return <Card className="p-5 sm:p-6"><div className="grid gap-7 lg:grid-cols-[210px_1fr]">
    <div>
      <p className="eyebrow">Briitely</p>
      <h2 className="section-heading mt-1">More details</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Custom fields from their Briitely contact. Changes save to Briitely.</p>
      {canEdit && <Button variant="outline" className="mt-4" disabled={saving} onClick={() => editing ? cancel() : setEditing(true)}><Pencil className="h-4 w-4" />{editing ? "Cancel" : "Edit More Details"}</Button>}
    </div>
    <div>
      {!fields ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading details...</p>
        : !editing ? <><p className="detail-label border-b border-border pb-2">Custom Fields</p><div className="grid gap-x-8 gap-y-4 pt-3 sm:grid-cols-2 lg:grid-cols-3">{fields.map((field) => <div key={field.id} className="min-w-0"><p className="detail-label">{field.name}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm font-medium">{shown(field)}</p></div>)}</div></>
        : <form onSubmit={save} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2">{fields.map((field) => field.editable
            ? <div key={field.id} className={field.dataType === "LARGE_TEXT" || MULTI.has(field.dataType) ? "sm:col-span-2" : undefined}><FieldInput field={field} value={values[field.id] ?? ""} disabled={saving} onChange={(value) => setValues((current) => ({ ...current, [field.id]: value }))} /></div>
            : <div key={field.id}><p className="detail-label">{field.name}</p><p className="mt-1 text-sm font-medium">{shown(field)}</p><p className="mt-1 text-xs text-muted-foreground">Edit this one in Briitely.</p></div>)}</div>
          <div className="flex justify-end"><Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Save More Details</Button></div></form>}
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    </div>
  </div></Card>;
}
