export type InvoiceStatusCategory = "valid" | "excluded";

export interface RevenueInvoiceTaxLine {
  name: string;
  amount: number;
}

export interface RevenueInvoice {
  id: string;
  number: string;
  contactId: string;
  customerName: string;
  issueDate: string;
  status: string;
  currency: string;
  subtotal: number;
  totalTax: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  taxLines: RevenueInvoiceTaxLine[];
  salespersonId: string | null;
  salespersonName: string;
  commissionSale: boolean;
}

export interface RevenueSummary {
  ytdSales: number;
  salesThisMonth: number;
  outstandingReceivables: number;
  taxInvoicedThisMonth: number;
}

export interface RevenueGroupRow {
  key: string;
  label: string;
  sales: number;
  percentage: number;
  invoiceCount: number;
}

export interface CustomerRevenueRow {
  contactId: string;
  customerName: string;
  assignedTo: string;
  ytdSales: number;
  outstanding: number;
  paid: number;
}

export interface CommissionSummary {
  commissionSales: number;
  commissionPaid: number;
  commissionOutstanding: number;
  invoiceCount: number;
}

export interface TaxByTypeRow {
  taxName: string;
  amount: number;
}

export interface TaxSummary {
  totalTax: number;
  byType: TaxByTypeRow[];
}

export interface RevenueData {
  summary: RevenueSummary;
  groups: RevenueGroupRow[];
  customerRevenue: CustomerRevenueRow[];
  commission: CommissionSummary | null;
  taxByTypeThisMonth: TaxByTypeRow[];
  includedStatuses: string[];
  excludedStatuses: string[];
  currency: string;
  locale: string;
  generatedAt: string;
}

export interface RevenueModuleConfig {
  enabled: boolean;
  currency: string;
  locale: string;
  reportingYearStartMonth: number;
  invoiceGoLiveDate?: string;
  grouping: {
    type: "assignedUser";
    label: string;
    users: Array<{ id: string; label: string }>;
    fallbackUserId: string;
  };
  commissions: {
    enabled: boolean;
  };
}

export interface ReportingPeriod {
  start: Date;
  end: Date;
  label: string;
}
