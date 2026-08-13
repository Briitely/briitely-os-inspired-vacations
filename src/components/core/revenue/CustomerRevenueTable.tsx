import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/core/ui/card";
import { ChevronRight } from "lucide-react";
import type { CustomerRevenueRow } from "@/lib/revenue/types";

interface CustomerRevenueTableProps {
  rows: CustomerRevenueRow[];
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

export function CustomerRevenueTable({ rows, currency, locale }: CustomerRevenueTableProps) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Customer Revenue</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No customer revenue for this period.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Customer Revenue</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide pb-2 pr-4">
                  Customer
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide pb-2 pr-4 hidden sm:table-cell">
                  Assigned To
                </th>
                <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wide pb-2 pr-4">
                  YTD Sales
                </th>
                <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wide pb-2 pr-4">
                  Paid
                </th>
                <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wide pb-2">
                  Outstanding
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.contactId} className="border-b border-border last:border-0 group">
                  <td className="py-2.5 pr-4">
                    <Link
                      href={`/customers/${encodeURIComponent(row.contactId)}`}
                      className="text-sm font-medium text-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
                    >
                      <span className="truncate max-w-[200px]">{row.customerName || row.contactId}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </Link>
                  </td>
                  <td className="py-2.5 pr-4 hidden sm:table-cell">
                    <span className="text-sm text-muted-foreground">{row.assignedTo}</span>
                  </td>
                  <td className="py-2.5 pr-4 text-right">
                    <span className="text-sm font-semibold text-foreground tabular-nums">
                      {formatCurrency(row.ytdSales, currency, locale)}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-right">
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {formatCurrency(row.paid, currency, locale)}
                    </span>
                  </td>
                  <td className="py-2.5 text-right">
                    <span className="text-sm text-foreground tabular-nums">
                      {formatCurrency(row.outstanding, currency, locale)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
