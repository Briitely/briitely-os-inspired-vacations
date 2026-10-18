"use client";

import { useEffect, useState } from "react";
import {AgreementProgress,AgreementPanel,AgreementAside,AgreementSummary} from "@/components/app/client-agreement-layout";

type SavedCard = {id:string;card_brand:string;last_four:string;label:string|null;is_preferred:boolean};
type AgreementPreview = {
  savedCards:SavedCard[];
  travelParty:string[];
  clientName: string;
  destination: string | null;
  departureDate: string | null;
  returnDate: string | null;
  depositAmount: number | null;
  accepted: boolean;
  acceptedAt: string | null;
  agreementVersion: string | null;
  agreementText: string | null;
};
function date(value: string | null) {
  return value ? new Date(value + "T00:00:00").toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" }) : "To be confirmed";
}
const agreementSections = [
  {title:"Your Travel Proposal",key:"proposal"},
  {title:"Deposit Agreement",key:"deposit"},
  {title:"Supplier Terms & Cancellation Policies",key:"supplier"},
  {title:"Traveller Responsibilities",key:"responsibilities"},

] as const;
function AgreementSections({text}:{text:string}){
  const lines=text.split("\n");
  const starts=agreementSections.map(section=>({title:section.title,index:lines.findIndex(line=>line.trim()===section.title)})).filter(section=>section.index>=0);
  if(!starts.length)return <div className="whitespace-pre-wrap rounded-lg border p-4 text-sm leading-7">{text}</div>;
  return <div className="space-y-4">{starts.map((section,i)=>{
    const content=lines.slice(section.index+1,starts[i+1]?.index??lines.length).join("\n").trim();
    return <section key={section.title} className="rounded-lg border bg-[#faf9f7] p-4 sm:p-5">
      <h4 className="mb-3 text-base font-semibold text-foreground">{section.title}</h4>
      <div className="space-y-3">{content.split(/\n\s*\n/).filter(Boolean).map((paragraph,j)=>{
        const rows=paragraph.split("\n").filter(Boolean);
        return rows.some(row=>row.trim().startsWith("•"))?<ul key={j} className="list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">{rows.map((row,k)=><li key={k}>{row.replace(/^\s*•\s*/,"")}</li>)}</ul>:<p key={j} className="whitespace-pre-line text-sm leading-6 text-muted-foreground">{paragraph}</p>;
      })}</div>
    </section>;
  })}</div>;
}
export function CustomerProposalAcceptance({ token }: { token: string }) {
  const [details, setDetails] = useState<AgreementPreview | null>(null);
  const [error, setError] = useState("");
  const [acceptedName, setAcceptedName] = useState("");
  const [checked, setChecked] = useState(false);
  const [reviewed,setReviewed]=useState<string[]>([]);
  const [showValidation,setShowValidation]=useState(false);
  const [paymentChoice,setPaymentChoice]=useState("");
  const [savedCardId,setSavedCardId]=useState("");
  const [saving, setSaving] = useState(false);
  const [signed, setSigned] = useState(false);
  const [travelInfo, setTravelInfo] = useState<{ preferences: string; loyaltyPrograms: string; completed: boolean } | null>(null);
  const [infoSaving, setInfoSaving] = useState(false);
  async function loadTravelInfo() {
    const response = await fetch("/api/proposal-acceptance/" + encodeURIComponent(token) + "/travel-information", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Unable to load travel information.");
    setTravelInfo(result);
  }
  async function submitTravelInfo() {
    if (!travelInfo) return;
    setInfoSaving(true); setError("");
    try {
      const response = await fetch("/api/proposal-acceptance/" + encodeURIComponent(token) + "/travel-information", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preferences: travelInfo.preferences, loyaltyPrograms: travelInfo.loyaltyPrograms }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save travel information.");
      setTravelInfo({ ...travelInfo, completed: true });
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save travel information."); }
    finally { setInfoSaving(false); }
  }
  async function sign() {
    setShowValidation(true);
    if (!details?.agreementVersion || !checked || reviewed.length!==3 || !acceptedName.trim() || !paymentChoice || (paymentChoice==="saved_card"&&!savedCardId)) return;
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/proposal-acceptance/" + encodeURIComponent(token), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accepted: true, acceptedName, agreementVersion: details.agreementVersion, paymentChoice, savedCardId }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not record your acceptance.");
      setSigned(true);
      await loadTravelInfo();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not record your acceptance."); }
    finally { setSaving(false); }
  }
  useEffect(() => {
    let active = true;
    fetch("/api/proposal-acceptance/" + encodeURIComponent(token), { cache: "no-store" })
      .then(async response => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Unable to load agreement.");
        return payload as AgreementPreview;
      })
      .then(data => { if (active) { setDetails(data);setPaymentChoice(data.savedCards?.length?"saved_card":"arrange_payment");setSavedCardId(data.savedCards?.find(c=>c.is_preferred)?.id??data.savedCards?.[0]?.id??""); if (data.accepted) void loadTravelInfo().catch(e => setError(e instanceof Error ? e.message : "Unable to load travel information.")); } })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load agreement."); });
    return () => { active = false; };
  }, [token]);
  if (error && !details) return <div role="alert" className="rounded-xl border bg-white p-6 text-sm text-red-700">{error}</div>;
  if (!details) return <div className="rounded-xl border bg-white p-6 text-sm">Loading your trip details…</div>;
  return (
    <div className="space-y-4">
      <AgreementProgress step={details.accepted || signed ? 2 : 1} first="Proposal and Deposit Agreement" second="Travel Preferences"/>
      <AgreementPanel>
      
      <div className="grid gap-5 md:grid-cols-[200px_1fr]">
        <AgreementAside eyebrow={details.accepted || signed ? "Step 2" : "Step 1"} title={details.accepted || signed ? "Travel Preferences" : "Proposal and Deposit Agreement"} text={details.accepted || signed ? "Confirm your travel preferences and loyalty information." : "Review your travel proposal and deposit agreement before continuing."}/>
        <div className="min-w-0">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AgreementSummary label="Destination" value={details.destination||"To be confirmed"}/>
        <div className="rounded-md border bg-background px-3 py-2"><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Travel dates</div><div className="mt-1 space-y-1 text-sm font-medium"><div>Departure: {date(details.departureDate)}</div><div>Return: {date(details.returnDate)}</div></div></div>
        <div className="rounded-md border bg-background px-3 py-2 sm:col-span-2"><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Travel party</div><div className="mt-1 text-sm font-medium">{details.travelParty?.length?details.travelParty.join(", "):details.clientName}</div></div>
      </div>

      {(details.accepted || signed) && <div className="mt-6 space-y-4 border-t pt-6">
        <h3 className="text-lg font-semibold">Travel Preferences & Loyalty Information</h3>
        <p className="text-sm text-muted-foreground">Review the primary traveller's information. Leave either field blank if it does not apply.</p>
        {travelInfo?.completed ? <p className="rounded-lg bg-[#f5f2ff] p-4 text-sm">Thank you. Your travel information has been received.</p> : travelInfo ? <>
          <label className="block text-sm font-medium">Preferred travel suppliers<textarea className="mt-1 block min-h-24 w-full rounded border p-3 font-normal" maxLength={5000} value={travelInfo.preferences} onChange={e => setTravelInfo({ ...travelInfo, preferences: e.target.value })} placeholder="Airlines, hotels, car rental companies" /></label>
          <label className="block text-sm font-medium">Rewards & loyalty programs<textarea className="mt-1 block min-h-24 w-full rounded border p-3 font-normal" maxLength={5000} value={travelInfo.loyaltyPrograms} onChange={e => setTravelInfo({ ...travelInfo, loyaltyPrograms: e.target.value })} placeholder="Program names and membership numbers" /></label>
          <button type="button" disabled={infoSaving} onClick={submitTravelInfo} className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{infoSaving ? "Saving..." : "Submit Travel Information"}</button>
        </> : <p className="text-sm">Loading travel information...</p>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      </div>}
      {details.agreementText && !details.accepted && !signed && <div className="mt-6 space-y-4">

        <AgreementSections text={details.agreementText} />
        <div className="grid items-start gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-lg border p-4"><h4 className="font-semibold">Deposit Payment Authorization</h4><p className="text-sm">Deposit: <strong>{new Intl.NumberFormat("en-CA",{style:"currency",currency:"CAD"}).format(details.depositAmount??0)}</strong></p>{details.savedCards?.length ? <><p className="text-sm">I authorize Inspired Vacations to charge the deposit fee on:</p><select className="w-full rounded border p-2 text-sm" value={paymentChoice==="saved_card"?savedCardId:"different_card"} onChange={e=>{if(e.target.value==="different_card")setPaymentChoice("different_card");else{setPaymentChoice("saved_card");setSavedCardId(e.target.value)}}}>{details.savedCards.map(c=><option key={c.id} value={c.id}>{c.card_brand} ending {c.last_four}{c.is_preferred?" (Preferred)":""}</option>)}<option value="different_card">Use a different card — advisor will follow up</option></select></> : <p className="text-sm">Your travel advisor will contact you to arrange payment securely.</p>}</div>
        <div className="space-y-3 rounded-lg border p-4"><h4 className="font-semibold">Review & confirm</h4><p className="text-sm text-muted-foreground">Please confirm each section before signing.</p>{[["proposal","I have reviewed the proposal and travel arrangements."],["terms","I understand the supplier terms, cancellation policies and traveller responsibilities."],["payment","I confirm my deposit amount and payment instructions."]].map(([id,label])=><label key={id} className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={reviewed.includes(id)} onChange={e=>setReviewed(old=>e.target.checked?[...old,id]:old.filter(item=>item!==id))}/>{label}</label>)}</div>
        </div>
        <label className="flex items-start gap-3 rounded-lg border p-4 text-sm"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} className="mt-1" /><span>I confirm that I have read, understood, and agree to the terms of this Proposal Agreement. I confirm that I am authorized to accept these terms on behalf of the travellers included in this booking and that I will communicate the applicable travel conditions and responsibilities to them. I understand that typing my name below is a legally binding means of accepting this Agreement and authorizes Inspired Vacations to proceed with charging the deposit fee and booking our travel.</span></label>
        <label className="block text-sm font-medium">Full name <input className="mt-1 block w-full rounded border px-3 py-2" value={acceptedName} onChange={e => setAcceptedName(e.target.value)} maxLength={200} /></label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {showValidation && (!checked || reviewed.length!==3 || !acceptedName.trim() || !paymentChoice || (paymentChoice==="saved_card"&&!savedCardId)) && <p role="alert" className="text-sm font-medium text-red-700">Please complete: {[reviewed.length!==3?"Review & confirm (all three checkboxes)":null,!checked?"Agreement confirmation":null,!acceptedName.trim()?"Full name":null,!paymentChoice || (paymentChoice==="saved_card"&&!savedCardId)?"Deposit payment selection":null].filter(Boolean).join(", ")}.</p>}
        <button type="button" disabled={saving} onClick={sign} className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{saving ? "Recording acceptance…" : "Accept Agreement"}</button>
      </div>}
        </div>
      </div>
      </AgreementPanel>
    </div>
  );
}
