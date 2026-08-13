"use client";

import { useEffect, useState } from "react";
import { RevenueMetricCard } from "./RevenueMetricCard";
import { RevenueByGroup } from "./RevenueByGroup";
import { CustomerRevenueTable } from "./CustomerRevenueTable";
import { CommissionSummaryCard } from "./CommissionSummary";
import type { RevenueData } from "@/lib/revenue/types";
import { DollarSign, CalendarDays, FileText, Receipt, TrendingUp } from "lucide-react";

function formatCurrency(amount: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function RevenueDashboard() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/revenue");
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || "We couldn't load revenue data. Please try again.");
        }
        const json = (await response.json()) as RevenueData;
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "We couldn't load revenue data. Please try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-foreground">Revenue Dashboard</h3>
        <p className="text-sm text-muted-foreground">Loading revenue...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-foreground">Revenue Dashboard</h3>
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm text-destructive" role="alert">
            {error || "We couldn't load revenue data. Please try again."}
          </p>
          <button
            onClick={() => {
              setLoading(true);
              setError(null);
              window.location.reload();
            }}
            className="mt-3 text-sm text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const { summary, currency, locale } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-lg font-bold text-foreground">Revenue Dashboard</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <RevenueMetricCard
          label="YTD Sales"
          value={formatCurrency(summary.ytdSales, currency, locale)}
          subtitle="Pre-tax invoice subtotals this reporting year"
          icon={<DollarSign className="h-4 w-4" />}
        />
        <RevenueMetricCard
          label="Sales This Month"
          value={formatCurrency(summary.salesThisMonth, currency, locale)}
          subtitle="Pre-tax subtotals issued this month"
          icon={<CalendarDays className="h-4 w-4" />}
        />
        <RevenueMetricCard
          label="Outstanding Receivables"
          value={formatCurrency(summary.outstandingReceivables, currency, locale)}
          subtitle="Unpaid balances across active invoices"
          icon={<FileText className="h-4 w-4" />}
        />
        <RevenueMetricCard
          label="Tax Invoiced This Month"
          value={formatCurrency(summary.taxInvoicedThisMonth, currency, locale)}
          subtitle="All sales tax on invoices issued this month"
          icon={<Receipt className="h-4 w-4" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueByGroup
          title="Sales by Person"
          rows={data.groups}
          currency={currency}
          locale={locale}
        />
        {data.commission && (
          <CommissionSummaryCard
            commission={data.commission}
            currency={currency}
            locale={locale}
          />
        )}
      </div>

      <CustomerRevenueTable
        rows={data.customerRevenue}
        currency={currency}
        locale={locale}
      />
    </div>
  );
}
