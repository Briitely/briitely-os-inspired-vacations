"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, X, XCircle } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/core/ui/card";
import { Input } from "@/components/core/ui/input";
import { Label } from "@/components/core/ui/label";
import { Badge } from "@/components/core/ui/badge";
import { ConsultationTravelPartyEditor, type ConsultationPartyMember } from "@/components/app/consultation-travel-party-editor";
import { tripTypeOptions, budgetRangeOptions } from "@/lib/travel/tag-mappings";
import { formatReadableDateTime } from "@/lib/travel/format";

interface Advisor { id: string; full_name: string; }
interface PreviousNote { id: string; note_type: string; note_text: string; created_at: string; author?: { id: string; full_name: string } | null; }
interface Props {
  travelFileId: string; clientName: string; destination: string | null; tripType: string | null; travelTimeframe: string | null;
  departureDate: string | null; returnDate: string | null; numberOfAdults: number | null; numberOfChildren: number | null;
  childrenAges: string | null; budgetRange: string | null; specialConsiderations: string | null; insuranceInterest: string | null;
  assignedAdvisorId: string | null; staffNotes: string | null; previousNotes: PreviousNote[]; isOpen: boolean; onClose: () => void;
}

const insuranceOptions = [
  "Yes, I want to add on insurance",
  "Please provide a quote for the Cancel For Unforeseen Reason (CFUR) coverage",
  "Please provide a quote for the All-Inclusive Package",
  "Please provide a quote for Non Medical Package",
  "I'm not sure, I would like to discuss further",
  "No, I DECLINE all travel insurance and will not hold the Travel Agent responsible for any potential losses that may occur",
];

export function CompleteConsultationModal(props: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null); const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [destination, setDestination] = useState(props.destination ?? ""); const [tripType, setTripType] = useState(props.tripType ?? ""); const [travelTimeframe, setTravelTimeframe] = useState(props.travelTimeframe ?? "");
  const [departureDate, setDepartureDate] = useState(props.departureDate ?? ""); const [returnDate, setReturnDate] = useState(props.returnDate ?? ""); const [budgetRange, setBudgetRange] = useState(props.budgetRange ?? "");
  const [specialConsiderations, setSpecialConsiderations] = useState(props.specialConsiderations ?? ""); const [insuranceInterest, setInsuranceInterest] = useState(props.insuranceInterest ?? "");
  const [party, setParty] = useState<ConsultationPartyMember[]>([]);
  const [isFit, setIsFit] = useState<"yes" | "no" | "">(""); const [agreementType, setAgreementType] = useState<"ivt" | "all_inclusive" | "">(""); const [tmfAmount, setTmfAmount] = useState("");
  const [assignedAdvisor, setAssignedAdvisor] = useState(props.assignedAdvisorId ?? ""); const [revisionsIncluded, setRevisionsIncluded] = useState(""); const [notFitReason, setNotFitReason] = useState("");
  const [consultationNote, setConsultationNote] = useState(""); const [consultationNoteType, setConsultationNoteType] = useState<"client_facing" | "internal">("internal");

  const loadAdvisors = useCallback(async () => { try { const r = await fetch("/api/travel-files/advisors"); if (r.ok) setAdvisors((await r.json()).advisors ?? []); } catch {} }, []);
  const advisorRef = useCallback((node: HTMLDivElement | null) => { if (node && props.isOpen && advisors.length === 0) loadAdvisors(); }, [props.isOpen, advisors.length, loadAdvisors]);
  const childCount = party.filter((m) => m.relationship_to_primary === "child").length; const travellerTotal = party.length; const adultCount = Math.max(0, travellerTotal - childCount);

  function validate() {
    if (travellerTotal < 1) return "Add at least one traveller to the Travel Party.";
    if (departureDate && returnDate && new Date(returnDate + "T00:00:00") < new Date(departureDate + "T00:00:00")) return "Return date cannot be before departure date.";
    if (!insuranceInterest) return "Travel Insurance preference is required."; if (!isFit) return "Please select whether this client is a fit.";
    if (isFit === "no") return notFitReason.trim() ? null : "Reason / Notes is required when client is not a fit.";
    if (!agreementType) return "Please select an agreement / trip category."; if (!tmfAmount || isNaN(parseFloat(tmfAmount)) || parseFloat(tmfAmount) < 0) return "TMF Amount is required and must be valid.";
    if (!assignedAdvisor) return "Assigned Advisor is required."; if (agreementType === "ivt" && (revisionsIncluded === "" || parseInt(revisionsIncluded, 10) < 0)) return "Number of Revisions Included is required for IVT agreements."; return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); const validation = validate(); if (validation) return setError(validation); setSaving(true); setError(null);
    const payload: Record<string, unknown> = { isFit, destination: destination.trim() || null, tripType: tripType || null, travelTimeframe: travelTimeframe.trim() || null, departureDate: departureDate || null, returnDate: returnDate || null,
      numberOfAdults: adultCount, numberOfChildren: childCount, childrenAges: null, budgetRange: budgetRange || null, specialConsiderations: specialConsiderations.trim() || null, insuranceInterest,
      consultationNote: consultationNote.trim() || null, consultationNoteType };
    if (isFit === "no") payload.notFitReason = notFitReason.trim(); else { payload.agreementType = agreementType; payload.tmfAmount = parseFloat(tmfAmount); payload.assignedAdvisorId = assignedAdvisor; if (agreementType === "ivt") payload.revisionsIncluded = parseInt(revisionsIncluded, 10); }
    try { const r = await fetch(`/api/travel-files/${props.travelFileId}/complete-consultation`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const data = await r.json(); if (!r.ok) return setError(data.error ?? "Failed to complete consultation."); props.onClose(); router.refresh(); }
    catch { setError("Something went wrong submitting the consultation."); } finally { setSaving(false); }
  }

  if (!props.isOpen) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><Card className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden shadow-xl">
    <CardHeader className="flex-row items-center justify-between space-y-0 border-b"><CardTitle>Complete Initial Consultation</CardTitle><button type="button" onClick={props.onClose}><X className="h-5 w-5" /></button></CardHeader>
    <form onSubmit={submit} className="flex flex-1 flex-col overflow-hidden"><CardContent className="flex-1 space-y-6 overflow-y-auto p-6">
      <div className="rounded-lg border bg-muted/30 p-4"><p className="text-xs font-medium uppercase text-muted-foreground">Client</p><p className="text-sm font-medium">{props.clientName}</p></div>
      {(props.staffNotes?.trim() || props.previousNotes.length > 0) && <section className="space-y-3"><h3 className="text-sm font-semibold">Previous Notes</h3>{props.staffNotes?.trim() && <div className="rounded-lg border bg-muted/30 p-3"><Badge variant="outline">Original Intake Note</Badge><p className="mt-1 whitespace-pre-wrap text-sm">{props.staffNotes}</p></div>}{props.previousNotes.map(n => <div key={n.id} className="rounded-lg border p-3"><div className="mb-1 flex items-center gap-2"><Badge variant={n.note_type === "client_facing" ? "default" : "secondary"}>{n.note_type === "client_facing" ? "Client-facing" : "Internal"}</Badge><span className="text-xs text-muted-foreground">{n.author?.full_name ?? "Unknown"} · {formatReadableDateTime(n.created_at)}</span></div><p className="whitespace-pre-wrap text-sm">{n.note_text}</p></div>)}</section>}
      <section className="space-y-4"><h3 className="text-sm font-semibold">Review / Update Trip Details</h3><div className="grid gap-4 sm:grid-cols-2">
        <Field label="Destination"><Input value={destination} onChange={e=>setDestination(e.target.value)} /></Field><Field label="Trip Type"><Select value={tripType} set={setTripType} options={tripTypeOptions} /></Field>
        <Field label="Travel Timeframe"><Input value={travelTimeframe} onChange={e=>setTravelTimeframe(e.target.value)} /></Field><Field label="Budget Range"><Select value={budgetRange} set={setBudgetRange} options={budgetRangeOptions} /></Field>
        <Field label="Departure Date"><Input type="date" value={departureDate} onChange={e=>setDepartureDate(e.target.value)} /></Field><Field label="Return Date"><Input type="date" value={returnDate} onChange={e=>setReturnDate(e.target.value)} /></Field>
      </div><ConsultationTravelPartyEditor travelFileId={props.travelFileId} onPartyChange={setParty} /><div className="grid gap-4 sm:grid-cols-3"><Summary label="Adults" value={adultCount} /><Summary label="Children" value={childCount} /><Summary label="Total Travellers" value={travellerTotal} /></div>
      <Field label="Special Considerations"><textarea value={specialConsiderations} onChange={e=>setSpecialConsiderations(e.target.value)} rows={2} className="w-full rounded-md border bg-background px-3 py-2 text-sm" /></Field>
      <Field label="Travel Insurance *"><Select value={insuranceInterest} set={setInsuranceInterest} options={insuranceOptions} /></Field></section>
      <section className="space-y-2"><Label>Is this client a fit? *</Label><div className="flex gap-4"><Radio label="Yes" value="yes" checked={isFit === "yes"} set={()=>setIsFit("yes")} icon={<CheckCircle2 className="h-4 w-4" />} /><Radio label="No" value="no" checked={isFit === "no"} set={()=>setIsFit("no")} icon={<XCircle className="h-4 w-4" />} /></div></section>
      {isFit === "no" && <Field label="Reason / Notes *"><textarea value={notFitReason} onChange={e=>setNotFitReason(e.target.value)} rows={3} className="w-full rounded-md border bg-background px-3 py-2 text-sm" /></Field>}
      {isFit === "yes" && <section className="space-y-4"><Field label="Agreement / Trip Category *"><div className="flex gap-4"><Radio label="IVT" value="ivt" checked={agreementType === "ivt"} set={()=>setAgreementType("ivt")} /><Radio label="All-Inclusive" value="all_inclusive" checked={agreementType === "all_inclusive"} set={()=>{setAgreementType("all_inclusive");setRevisionsIncluded("");}} /></div></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="TMF Amount *"><Input type="number" min="0" step="0.01" value={tmfAmount} onChange={e=>setTmfAmount(e.target.value)} /></Field><div ref={advisorRef}><Field label="Assigned Advisor *"><select value={assignedAdvisor} onChange={e=>setAssignedAdvisor(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Select an advisor...</option>{advisors.map(a=><option key={a.id} value={a.id}>{a.full_name}</option>)}</select></Field></div></div>{agreementType === "ivt" && <Field label="Number of Revisions Included *"><Input type="number" min="0" step="1" value={revisionsIncluded} onChange={e=>setRevisionsIncluded(e.target.value)} /></Field>}</section>}
      <section className="space-y-3"><h3 className="text-sm font-semibold">Consultation Note (Optional)</h3><Field label="Note Type"><select value={consultationNoteType} onChange={e=>setConsultationNoteType(e.target.value as "client_facing"|"internal")} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="internal">Internal</option><option value="client_facing">Client-facing</option></select></Field><Field label="Note"><textarea value={consultationNote} onChange={e=>setConsultationNote(e.target.value)} rows={3} className="w-full rounded-md border bg-background px-3 py-2 text-sm" /></Field></section>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </CardContent><div className="flex justify-end gap-3 border-t p-4"><Button type="button" variant="outline" onClick={props.onClose} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}{saving ? "Saving..." : "Complete Consultation"}</Button></div></form>
  </Card></div>;
}

function Field({label,children}:{label:string;children:React.ReactNode}) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
function Select({value,set,options}:{value:string;set:(v:string)=>void;options:readonly string[]|string[]}) { return <select value={value} onChange={e=>set(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Select...</option>{options.map(o=><option key={o} value={o}>{o}</option>)}</select>; }
function Summary({label,value}:{label:string;value:number}) { return <div className="rounded-md border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-lg font-semibold">{value}</p></div>; }
function Radio({label,value,checked,set,icon}:{label:string;value:string;checked:boolean;set:()=>void;icon?:React.ReactNode}) { return <label className="flex cursor-pointer items-center gap-2"><input type="radio" value={value} checked={checked} onChange={set} /><span className="flex items-center gap-1 text-sm">{icon}{label}</span></label>; }
