"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TravelFileInfo as Info } from "@/components/app/travel-file-display";
import { asksForEvent, type ClientReferral } from "@/lib/referrals/options";

/**
 * The client's referral, shown read-only on a travel file. It lives on the
 * client file; travel files made before the move fall back to what was saved
 * on the trip until the client's referral is filled in.
 */
export function ClientReferralSummary({ contactId, fallback }: { contactId: string; fallback: ClientReferral }) {
  const [referral, setReferral] = useState<ClientReferral | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/customers/${encodeURIComponent(contactId)}/referral`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (active) setReferral(d ? { leadSource: d.leadSource ?? "", referralName: d.referralName ?? "", eventName: d.eventName ?? "" } : null); })
      .catch(() => { if (active) setReferral(null); });
    return () => { active = false; };
  }, [contactId]);

  const shown = referral?.leadSource ? referral : fallback;
  const label = <span>How they heard about us <Link href={`/customers/${encodeURIComponent(contactId)}`} className="ml-1 normal-case tracking-normal text-primary hover:underline">(edit on client file)</Link></span>;
  return <>
    <Info label={label} value={shown.leadSource} />
    {asksForEvent(shown.leadSource) ? <Info label="Which event?" value={shown.eventName} /> : <Info label="Referral name" value={shown.referralName} />}
  </>;
}
