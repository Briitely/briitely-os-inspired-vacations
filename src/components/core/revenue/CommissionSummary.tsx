import { Card, CardContent, CardHeader, CardTitle } from "@/components/core/ui/card";
import type { CommissionSummary } from "@/lib/revenue/types";

interface CommissionSummaryCardProps {
  commission: CommissionSummary;
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

export function CommissionSummaryCard({ commission, currency, locale }: CommissionSummaryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Commission Sales</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Sales</p>
            <p className="text-lg font-bold text-foreground tabular-nums">
              {formatCurrency(commission.commissionSales, currency, locale)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Paid</p>
            <p className="text-lg font-bold text-foreground tabular-nums">
              {formatCurrency(commission.commissionPaid, currency, locale)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Outstanding</p>
            <p className="text-lg font-bold text-foreground tabular-nums">
              {formatCurrency(commission.commissionOutstanding, currency, locale)}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {commission.invoiceCount} commission {commission.invoiceCount === 1 ? "invoice" : "invoices"} this reporting year
        </p>
      </CardContent>
    </Card>
  );
}
