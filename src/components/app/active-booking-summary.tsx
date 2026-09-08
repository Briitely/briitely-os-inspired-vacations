"use client";

import { useEffect, useRef, useState } from "react";

export interface BookingSummary {
  primarySupplier: string | null;
  supplierFinalPaymentDate: string | null;
  clientFinalPaymentDate: string | null;
  travelTimeframe: string | null;
  budgetRange: string | null;
  revisionsUsed: number;
  revisionsIncluded: number | null;
}

export function useBookingSummary(travelFileId: string) {
  const [summary, setSummary] = useState<BookingSummary | null>(null);
  useEffect(() => {
    let active = true;
    fetch(`/api/travel-files/${encodeURIComponent(travelFileId)}/booking-summary`, { cache: "no-store" })
      .then(async response => response.ok ? await response.json() as BookingSummary : null)
      .then(data => { if (active && data) setSummary(data); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [travelFileId]);
  return summary;
}

function Item({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-1 break-words text-sm font-medium">{value || "—"}</div></div>;
}

export function ActiveBookingSummary({ travelFileId }: { travelFileId: string }) {
  const summary = useBookingSummary(travelFileId);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    const grid = root?.closest(".grid") as HTMLElement | null;
    if (!grid) return;

    const hidden: HTMLElement[] = [];
    for (const child of Array.from(grid.children)) {
      const element = child as HTMLElement;
      const text = (element.textContent ?? "").replace(/\s+/g, " ").trim().toLowerCase();
      if (text.startsWith("revisions used")) {
        element.style.display = "none";
        hidden.push(element);
      }
    }

    return () => {
      for (const element of hidden) element.style.display = "";
    };
  }, [summary]);

  if (!summary) return null;
  return <div ref={rootRef} className="contents"><Item label="Primary Supplier" value={summary.primarySupplier ?? "—"} /></div>;
}

export function InquiryPlanningSummary({ travelFileId }: { travelFileId: string }) {
  const summary = useBookingSummary(travelFileId);
  if (!summary) return null;
  return <><Item label="Travel Timeframe" value={summary.travelTimeframe ?? "—"}/><Item label="Budget" value={summary.budgetRange ?? "—"}/></>;
}

export function RetainerRevisionSummary({ travelFileId }: { travelFileId: string }) {
  const summary = useBookingSummary(travelFileId);
  if (!summary) return null;
  const included = summary.revisionsIncluded == null ? "—" : String(summary.revisionsIncluded);
  const used = summary.revisionsIncluded == null ? String(summary.revisionsUsed) : `${summary.revisionsUsed} of ${summary.revisionsIncluded}`;
  return <><Item label="Revisions Included" value={included}/><Item label="Revisions Used" value={used}/></>;
}
