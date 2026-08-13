import { Card, CardContent, CardHeader, CardTitle } from "@/components/core/ui/card";
import type { RevenueGroupRow } from "@/lib/revenue/types";

interface RevenueByGroupProps {
  title: string;
  rows: RevenueGroupRow[];
  currency: string;
  locale: string;
}

function formatCurrency(amount: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function RevenueByGroup({ title, rows, currency, locale }: RevenueByGroupProps) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No sales data for this period.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 pb-2 border-b border-border">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Name</p>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide text-right">Sales</p>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide text-right w-16">Share</p>
          </div>
          {rows.map((row) => (
            <div
              key={row.key}
              className="grid grid-cols-[1fr_auto_auto] gap-4 py-2.5 border-b border-border last:border-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{row.label}</p>
                <p className="text-xs text-muted-foreground">
                  {row.invoiceCount} {row.invoiceCount === 1 ? "invoice" : "invoices"}
                </p>
              </div>
              <p className="text-sm font-semibold text-foreground tabular-nums text-right self-center">
                {formatCurrency(row.sales, currency, locale)}
              </p>
              <p className="text-sm text-muted-foreground tabular-nums text-right self-center w-16">
                {formatPercentage(row.percentage)}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
