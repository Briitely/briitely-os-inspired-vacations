"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { Input } from "@/components/core/ui/input";
import { Label } from "@/components/core/ui/label";
import { osConfirm } from "@/components/core/ui/os-dialog";
import { DeploymentStageModal, type DeploymentChoice } from "@/components/app/deployment-stage-modal";
import { CompleteCustomerDetails, FindCustomerStep, SelectedCustomer } from "@/components/app/customer-first";
import { FormSectionCard } from "@/components/app/form-section-card";
import type { BriitelyCustomer } from "@/lib/briitely/types";
import { travelInterestOptions, travelSeasonOptions, referralSourceOptions, tripTypeOptions, budgetRangeOptions, intakeMethodOptions } from "@/lib/travel/tag-mappings";

/*
 * New Inquiry, on the Briitely OS "find the client first" standard:
 * Step 1 finds the client (or creates them right there), then the inquiry
 * form opens for that client as a stack of split cards. Contact details are
 * edited on the client file, not retyped here.
 */

type Client = Pick<BriitelyCustomer, "id" | "name" | "firstName" | "lastName" | "companyName" | "email" | "phone"> & { isDnb: boolean };

const namedReferralSources = new Set(["Referral", "BNI", "Breakfast Club", "Existing Client", "Rotary"]);
const lostReasons = ["Fear-World Events", "No Response", "Budget", "Health", "Not a Fit", "Life Circumstances", "Booked Elsewhere"];
const selectClass = "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm";
const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

function toClient(customer: BriitelyCustomer & { isDnb?: boolean }): Client {
  return {
    id: customer.id, name: customer.name ?? "", firstName: customer.firstName ?? "", lastName: customer.lastName ?? "",
    companyName: customer.companyName ?? "", email: customer.email ?? "", phone: customer.phone ?? "", isDnb: Boolean(customer.isDnb),
  };
}

export function StaffIntakeForm({ initialCustomerId }: { initialCustomerId?: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [deployOpen, setDeployOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  // True when the client was created in step 1, so the referral question shows.
  const [createdNow, setCreatedNow] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(Boolean(initialCustomerId));
  // A chosen client missing the email or phone the inquiry needs: complete their details first.
  const [completing, setCompleting] = useState<{ customer: BriitelyCustomer; isDnb: boolean; created: boolean } | null>(null);
  const [destination, setDestination] = useState("");
  const [tripType, setTripType] = useState("");
  const [travelTimeframe, setTravelTimeframe] = useState("");
  const [budgetRange, setBudgetRange] = useState("");
  const [numberOfAdults, setNumberOfAdults] = useState("");
  const [numberOfChildren, setNumberOfChildren] = useState("");
  const [childrenAges, setChildrenAges] = useState("");
  const [travelInterests, setTravelInterests] = useState<string[]>([]);
  const [travelSeasons, setTravelSeasons] = useState<string[]>([]);
  const [referralSource, setReferralSource] = useState("");
  const [referralDetail, setReferralDetail] = useState("");
  const [eventDetail, setEventDetail] = useState("");
  const [specialConsiderations, setSpecialConsiderations] = useState("");
  const [intakeMethod, setIntakeMethod] = useState("phone");
  const [staffNotes, setStaffNotes] = useState("");
  const [isFit, setIsFit] = useState<"yes" | "no" | "">("");
  const [markDnb, setMarkDnb] = useState<"yes" | "no" | "">("");
  const [lostReason, setLostReason] = useState("");

  async function select(chosen: Client, created = false) {
    setClient(chosen);
    setCreatedNow(created);
    setError(null);
    setReferralSource(""); setReferralDetail(""); setEventDetail("");
    setIsFit(chosen.isDnb ? "no" : ""); setMarkDnb(chosen.isDnb ? "yes" : ""); setLostReason(chosen.isDnb ? "Not a Fit" : "");
    setTravelInterests([]); setTravelSeasons([]); setSpecialConsiderations("");
    if (created) return;
    // An existing client's saved interests, seasons and considerations carry into the inquiry.
    try {
      const r = await fetch(`/api/customers/${encodeURIComponent(chosen.id)}/travel-profile`), d = await r.json();
      if (r.ok) { setTravelInterests(d.profile?.travel_interests ?? []); setTravelSeasons(d.profile?.travel_seasons ?? []); }
    } catch { /* keep the form usable */ }
    try {
      const r = await fetch(`/api/customers/${encodeURIComponent(chosen.id)}/traveller-profile`), d = await r.json();
      setSpecialConsiderations(r.ok ? d.profile?.special_considerations ?? "" : "");
    } catch { setSpecialConsiderations(""); }
  }

  async function chooseFromFinder(customer: BriitelyCustomer & { isDnb?: boolean }, details?: { created: boolean }) {
    const created = Boolean(details?.created);
    let isDnb = Boolean(customer.isDnb);
    if (!created && customer.isDnb === undefined) {
      try {
        const r = await fetch(`/api/customers/${encodeURIComponent(customer.id)}/traveller-profile`);
        isDnb = r.ok ? Boolean((await r.json()).profile?.is_dnb) : false;
      } catch { isDnb = false; }
    }
    await openClient({ ...customer, isDnb }, created);
  }

  // Goes into the inquiry, or first to Complete the Client's Details when the email or phone is missing.
  async function openClient(customer: BriitelyCustomer & { isDnb: boolean }, created = false) {
    if (customer.email && customer.phone) return select(toClient(customer), created);
    let full: BriitelyCustomer = customer;
    try {
      const r = await fetch(`/api/customers/${encodeURIComponent(customer.id)}`), d = await r.json();
      if (r.ok && d.customer) full = d.customer;
    } catch { /* fill in from what search returned */ }
    setError(null);
    setCompleting({ customer: full, isDnb: customer.isDnb, created });
  }

  // Started from a client file: open the form for that client straight away.
  useEffect(() => {
    if (!initialCustomerId) return;
    let active = true;
    (async () => {
      try {
        const [r, p] = await Promise.all([fetch(`/api/customers/${encodeURIComponent(initialCustomerId)}`), fetch(`/api/customers/${encodeURIComponent(initialCustomerId)}/traveller-profile`)]);
        const d = await r.json(), pd = p.ok ? await p.json() : {};
        if (!r.ok || !d.customer) throw new Error(d.error || "Could not load this client.");
        if (active) await openClient({ ...d.customer, isDnb: Boolean(pd.profile?.is_dnb) });
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Could not load this client.");
      } finally {
        if (active) setLoadingInitial(false);
      }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCustomerId]);

  const missingContact = client ? [!client.email && "email", !client.phone && "phone"].filter(Boolean) as string[] : [];

  function checkReady(): boolean {
    if (missingContact.length) { setError(`Add the client's ${missingContact.join(" and ")} on their client file first.`); return false; }
    if (!isFit) { setError("Please select whether this client is a fit."); return false; }
    if (!markDnb) { setError("Please select whether to mark this client DNB."); return false; }
    if (isFit === "no" && !lostReason) { setError("Please select a Lost Reason."); return false; }
    return true;
  }

  function openDeployment() {
    if (!formRef.current?.reportValidity() || !checkReady()) return;
    if (isFit !== "yes") return setError("Mark the client as a fit before choosing a deployment stage.");
    setError(null);
    setDeployOpen(true);
  }

  async function submit(e: React.FormEvent | null, deployment: DeploymentChoice | null = null) {
    e?.preventDefault();
    if (!client || !checkReady()) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch("/api/intake/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          briitelyContactId: client.id, newClient: createdNow,
          firstName: client.firstName, lastName: client.lastName, email: client.email, phone: client.phone,
          destination, tripType, travelTimeframe, budgetRange,
          numberOfAdults: numberOfAdults ? parseInt(numberOfAdults, 10) : 0,
          numberOfChildren: numberOfChildren ? parseInt(numberOfChildren, 10) : null,
          childrenAges: childrenAges || null, travelInterests, travelSeasons,
          referralSource: createdNow ? referralSource : "",
          referralDetail: createdNow && namedReferralSources.has(referralSource) ? referralDetail : null,
          eventDetail: createdNow && referralSource === "Event" ? eventDetail : null,
          specialConsiderations: specialConsiderations || null, intakeMethod, staffNotes: staffNotes || null,
          isFit, markDnb: markDnb === "yes", lostReason: isFit === "no" ? lostReason : null, consent: true, deployment,
        }),
      });
      const d = await r.json();
      if (!r.ok) setError(d.error ?? "Submission failed.");
      else if (d.travelFileId) {
        if (d.deploymentError) await osConfirm({ eyebrow: "Travel File", title: "Stage Not Set", message: `The Travel File was created, but it could not be moved to the selected stage (${d.deploymentError}). It is waiting at Book Initial Consultation and no inquiry email was sent. Use Override on the file to move it.`, confirmLabel: "Open Travel File" });
        router.push(`/travel-files/${d.travelFileId}`);
      } else if (isFit === "no" && markDnb === "yes") router.push("/dashboard");
      else if (d.briitelyContactId) router.push(`/customers/${d.briitelyContactId}`);
    } catch {
      setError("Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingInitial) return <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading client...</div>;

  if (completing) {
    const missing = (["email", "phone"] as const).filter((key) => !completing.customer[key]);
    return (
      <CompleteCustomerDetails
        noun="client"
        recordLabel="inquiry"
        customer={completing.customer}
        missing={[...missing]}
        onSaved={(saved) => { const { isDnb, created } = completing; setCompleting(null); void select({ ...toClient(saved), isDnb }, created); }}
        onCancel={() => setCompleting(null)}
      />
    );
  }

  if (!client) {
    return (
      <div className="space-y-4">
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <FindCustomerStep noun="client" recordLabel="inquiry" onCustomerSelected={(customer, details) => void chooseFromFinder(customer, details)} />
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-6">
      <FormSectionCard eyebrow="Step 2 of 2 · Client" title="Client" description="Who this inquiry is for. Contact details are edited on the client file.">
        <div className="space-y-3">
          <SelectedCustomer noun="client" customer={client} onChange={() => { setClient(null); setCreatedNow(false); setError(null); }} />
          {client.isDnb && <p><span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">DNB</span> <span className="text-sm text-muted-foreground">This client is marked Do Not Book.</span></p>}
          {missingContact.length > 0 && (
            <p className="text-sm text-destructive">
              This client has no {missingContact.join(" or ")} yet, which the inquiry needs. <Link href={`/customers/${encodeURIComponent(client.id)}`} className="font-medium underline">Open the client file</Link> to update their contact details.
            </p>
          )}
        </div>
      </FormSectionCard>

      <FormSectionCard eyebrow="Fit" title="Client Fit" description="Is this a client the team wants to plan for?">
        <div className="grid gap-4 sm:grid-cols-2">
          <Choice label="Is this client a fit? *" value={isFit} set={(v) => { setIsFit(v); if (v === "yes") setLostReason(""); }} />
          <Choice label="Mark Client DNB? *" value={markDnb} set={setMarkDnb} />
          {isFit === "no" && <div className="sm:col-span-2"><Field label="Lost Reason *"><Select value={lostReason} set={setLostReason} options={lostReasons} /></Field></div>}
        </div>
      </FormSectionCard>

      <FormSectionCard eyebrow="Intake" title="Intake Method" description="How this inquiry came in.">
        <select value={intakeMethod} onChange={(e) => setIntakeMethod(e.target.value)} className={selectClass}>{intakeMethodOptions.map((o) => <option key={o}>{o}</option>)}</select>
      </FormSectionCard>

      <FormSectionCard eyebrow="Trip" title="Trip Details" description="Add what you know. Trip details can be completed later.">
        <div className="space-y-4">
          <Field label="Where do they want to go?"><Input value={destination} onChange={(e) => setDestination(e.target.value)} /></Field>
          <Field label="Trip Type"><Select value={tripType} set={setTripType} options={tripTypeOptions} /></Field>
          <Field label="Travel Dates or Timeframe"><Input value={travelTimeframe} onChange={(e) => setTravelTimeframe(e.target.value)} /></Field>
          <Field label="Budget per Person"><Select value={budgetRange} set={setBudgetRange} options={budgetRangeOptions} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Adults"><Input type="number" min="0" value={numberOfAdults} onChange={(e) => setNumberOfAdults(e.target.value)} /></Field>
            <Field label="Children"><Input type="number" min="0" value={numberOfChildren} onChange={(e) => { setNumberOfChildren(e.target.value); if (!e.target.value || +e.target.value === 0) setChildrenAges(""); }} /></Field>
          </div>
          {+numberOfChildren > 0 && <Field label="Ages of Children"><Input value={childrenAges} onChange={(e) => setChildrenAges(e.target.value)} /></Field>}
        </div>
      </FormSectionCard>

      <FormSectionCard eyebrow="Interests" title="Travel Interests & Season" description="What they enjoy and when they like to travel.">
        <div className="space-y-5">
          <Checks title="Travel Interests" options={travelInterestOptions.map((x) => x.label)} selected={travelInterests} set={setTravelInterests} />
          <Checks title="Travel Season" options={travelSeasonOptions.map((x) => x.label)} selected={travelSeasons} set={setTravelSeasons} />
        </div>
      </FormSectionCard>

      {createdNow && (
        <FormSectionCard eyebrow="Referral" title="How They Heard About Us" description="Optional. Record it if you know it; it isn't needed to create the inquiry.">
          <div className="space-y-4">
            <select value={referralSource} onChange={(e) => { setReferralSource(e.target.value); setReferralDetail(""); setEventDetail(""); }} className={selectClass}>
              <option value="">Select...</option>
              {referralSourceOptions.map((o) => <option key={o.label} value={o.label}>{o.label}</option>)}
            </select>
            {namedReferralSources.has(referralSource) && <Field label="Who referred them?"><Input value={referralDetail} onChange={(e) => setReferralDetail(e.target.value)} /></Field>}
            {referralSource === "Event" && <Field label="Which event?"><Input value={eventDetail} onChange={(e) => setEventDetail(e.target.value)} /></Field>}
          </div>
        </FormSectionCard>
      )}

      <FormSectionCard eyebrow="Notes" title="Additional Information" description="Anything the team should know.">
        <div className="space-y-4">
          <Field label="Special Considerations"><textarea value={specialConsiderations} onChange={(e) => setSpecialConsiderations(e.target.value)} className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm" /></Field>
          <Field label="Staff Notes (internal only)"><textarea value={staffNotes} onChange={(e) => setStaffNotes(e.target.value)} className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm" /></Field>
        </div>
      </FormSectionCard>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap justify-end gap-3">
        {isFit !== "no" && <Button type="button" variant="outline" disabled={submitting} onClick={openDeployment}>Choose Deployment Stage</Button>}
        <Button type="submit" disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{isFit === "no" && markDnb === "yes" ? "Save DNB Inquiry" : "Create Inquiry"}</Button>
      </div>
      <DeploymentStageModal isOpen={deployOpen} submitting={submitting} error={deployOpen ? error : null} onClose={() => setDeployOpen(false)} onConfirm={(choice) => void submit(null, choice)} />
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function Select({ value, set, options }: { value: string; set: (v: string) => void; options: string[] | readonly string[] }) {
  return <select value={value} onChange={(e) => set(e.target.value)} className={selectClass}><option value="">Select...</option>{options.map((o) => <option key={o}>{o}</option>)}</select>;
}

function Choice({ label, value, set }: { label: string; value: "yes" | "no" | ""; set: (v: "yes" | "no") => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-5">
        <label className="flex items-center gap-2"><input type="radio" checked={value === "yes"} onChange={() => set("yes")} />Yes</label>
        <label className="flex items-center gap-2"><input type="radio" checked={value === "no"} onChange={() => set("no")} />No</label>
      </div>
    </div>
  );
}

function Checks({ title, options, selected, set }: { title: string; options: string[]; selected: string[]; set: (v: string[]) => void }) {
  return (
    <div>
      <p className="os-detail-group-label">{title}</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((o) => <label key={o} className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2"><input type="checkbox" checked={selected.includes(o)} onChange={() => set(toggle(selected, o))} /><span className="text-sm">{o}</span></label>)}
      </div>
    </div>
  );
}
