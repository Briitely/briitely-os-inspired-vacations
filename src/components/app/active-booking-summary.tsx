"use client";

import { useEffect, useState } from "react";

interface BookingSummary {
  primarySupplier: string | null;
  supplierFinalPaymentDate: string | null;
  clientFinalPaymentDate: string | null;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 break-words text-sm font-medium">{value || "—"}</div>
    </div>
  );
}

export function ActiveBookingSummary({ travelFileId }: { travelFileId: string }) {
  const [summary, setSummary] = useState<BookingSummary | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/travel-files/${encodeURIComponent(travelFileId)}/booking-summary`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as BookingSummary;
      })
      .then((data) => {
        if (active && data) setSummary(data);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [travelFileId]);

  if (!summary) return null;

  return (
    <>
      <Item label="Primary Supplier" value={summary.primarySupplier ?? "—"} />
      <Item label="Supplier Final Payment" value={formatDate(summary.supplierFinalPaymentDate)} />
      <Item label="Client Final Payment" value={formatDate(summary.clientFinalPaymentDate)} />
    </>
  );
}
