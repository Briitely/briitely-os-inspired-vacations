"use client";

import { useEffect, useState } from "react";

type SavedCard = {id:string;card_brand:string;last_four:string;label:string|null;is_preferred:boolean};
type AgreementPreview = {
  savedCards:SavedCard[];
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
  {title:"Acceptance on Behalf of Travellers",key:"travellers"},
  {title:"Electronic Acceptance",key:"electronic"}
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
    <section className="rounded-xl border border-[#e7c8bd] bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-6 flex items-center gap-3 text-xs font-medium"><span className="text-primary">1. Proposal & Deposit Agreement</span><span className="text-muted-foreground">›</span><span className="text-muted-foreground">2. Travel Preferences</span></div>
      <div className="grid gap-5 lg:grid-cols-[165px_minmax(0,1fr)]">
        <aside className="pt-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">Step {details.accepted || signed ? "2" : "1"}</p>
          <h2 className="mt-1 font-serif text-lg">{details.accepted || signed ? "Travel Preferences" : "Proposal Acceptance & Deposit Agreement"}</h2>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{details.accepted || signed ? "Confirm your travel preferences and loyalty information." : "Review your travel proposal and deposit agreement before continuing."}</p>
        </aside>
        <div className="min-w-0">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-[#faf9f7] p-3"><p className="text-xs uppercase text-muted-foreground">Destination</p><p className="mt-1 font-semibold">{details.destination||"To be confirmed"}</p></div>
        <div className="rounded-lg border bg-[#faf9f7] p-3"><p className="text-xs uppercase text-muted-foreground">Travel dates</p><p className="mt-1 text-sm font-semibold">{date(details.departureDate)} – {date(details.returnDate)}</p></div>
        <div className="rounded-lg border bg-[#faf9f7] p-3"><p className="text-xs uppercase text-muted-foreground">Deposit amount</p><p className="mt-1 text-lg font-semibold">{details.depositAmount==null?"Contact your advisor":new Intl.NumberFormat("en-CA",{style:"currency",currency:"CAD"}).format(details.depositAmount)}</p></div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Prepared for {details.clientName}</p>
      <div className="mt-6 rounded-lg bg-[#f5f2ff] p-4 text-sm">
        {details.accepted || signed ? "Your acceptance has been recorded. No deposit has been charged." : !details.agreementText ? "Agreement signing is not yet available. Please contact your Inspired Vacations advisor before making a deposit." : "Review the agreement below before signing. Signing does not process a payment."}
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
        <h3 className="font-semibold">Proposal Acceptance & Deposit Agreement</h3>
        <AgreementSections text={details.agreementText} />
        <div className="grid items-start gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-lg border p-4"><h4 className="font-semibold">Deposit Payment Authorization</h4><p className="text-sm">Deposit to be arranged: <strong>{new Intl.NumberFormat("en-CA",{style:"currency",currency:"CAD"}).format(details.depositAmount??0)}</strong>. No payment will be processed when you sign.</p>{details.savedCards?.length ? <><label className="flex gap-2 text-sm"><input type="radio" name="deposit-card" checked={paymentChoice==="saved_card"} onChange={()=>setPaymentChoice("saved_card")}/>Use a card already on file</label>{paymentChoice==="saved_card"&&<select className="w-full rounded border p-2 text-sm" value={savedCardId} onChange={e=>setSavedCardId(e.target.value)}>{details.savedCards.map(c=><option key={c.id} value={c.id}>{c.card_brand} ending {c.last_four}{c.is_preferred?" (Preferred)":""}</option>)}</select>}<label className="flex gap-2 text-sm"><input type="radio" name="deposit-card" checked={paymentChoice==="different_card"} onChange={()=>setPaymentChoice("different_card")}/>I'd like to use a different card — my travel advisor will follow up.</label></> : <p className="text-sm">No saved card is available. Your travel advisor will contact you to arrange payment securely.</p>}</div>
        <div className="space-y-3 rounded-lg border p-4"><h4 className="font-semibold">Review & confirm</h4><p className="text-sm text-muted-foreground">Please confirm each section before signing.</p>{[["proposal","I have reviewed the proposal and travel arrangements."],["terms","I understand the supplier terms, cancellation policies and traveller responsibilities."],["payment","I confirm my deposit amount and payment instructions."]].map(([id,label])=><label key={id} className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={reviewed.includes(id)} onChange={e=>setReviewed(old=>e.target.checked?[...old,id]:old.filter(item=>item!==id))}/>{label}</label>)}</div>
        </div>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} className="mt-1" />I have read and agree to the terms above.</label>
        <label className="block text-sm font-medium">Full name <input className="mt-1 block w-full rounded border px-3 py-2" value={acceptedName} onChange={e => setAcceptedName(e.target.value)} maxLength={200} /></label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button type="button" disabled={!checked || !acceptedName.trim() || !paymentChoice || (paymentChoice==="saved_card"&&!savedCardId) || saving} onClick={sign} className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{saving ? "Recording acceptance…" : "Accept Agreement"}</button>
      </div>}
        </div>
      </div>
    </section>
  );
}
