import type { ClientTaxConfig, TaxType } from "@/lib/tax/types";
import type { RevenueModuleConfig } from "@/lib/revenue/types";

export interface HighLevelTaxMapping {
  id: string;
  name: string;
}

export const clientTaxConfig: ClientTaxConfig = {
  country: "CA",
  basis: "destination",
  registrations: {
    GST_HST: false,
    BC_PST: false,
    SK_PST: false,
    MB_RST: false,
    QC_QST: false,
  },
};

export const clientHighLevelTaxes: Partial<Record<TaxType, HighLevelTaxMapping>> = {
  GST: { id: "", name: "GST" },
  SK_PST: { id: "", name: "SK Tax" },
  BC_PST: { id: "", name: "BC Tax" },
};

export const clientConfig = {
  identity: {
    name: "Your Business",
    shortName: "Briitely OS",
  appTitle: "Briitely OS — Business Dashboard",
    appDescription: "Internal business dashboard",
  },
  invoiceBranding: {
    logoPath: "",
    businessName: "Your Business",
    address: "",
    phone: "",
    website: "",
    paymentInstructions: "",
    latePaymentTerms: "",
  },
  users: {
    fallbackUsers: [] as Array<{ id: string; label: string }>,
  },
  defaultInvoiceSenderUserId: "",
  defaultInvoiceSenderEmail: "",
  invoiceGoLiveDate: "",
  taxConfig: clientTaxConfig,
  features: {
    authentication: { enabled: true },
    usersAccess: { enabled: true },
    businessSettings: { enabled: true },
    customerSearch: { enabled: true, label: "Find or Create Customer" },
    invoiceCreation: { enabled: true, label: "Create Invoice" },
    invoiceEditing: { enabled: true },
    invoiceSending: { enabled: true },
    invoicePrinting: { enabled: true },
    paymentRecording: { enabled: true, label: "Receive Payment" },
    invoiceHistory: { enabled: true },
    revenueDashboard: { enabled: true },
    recentWork: { enabled: true },
    commissions: { enabled: false },
    reports: { enabled: false, label: "Reports" },
    diagnostics: { enabled: true, access: "super_admin" as const },
  },
  revenue: {
    enabled: true,
    currency: "CAD",
    locale: "en-CA",
    reportingYearStartMonth: 1,
    grouping: {
      type: "assignedUser" as const,
      label: "Sales by Person",
      users: [] as Array<{ id: string; label: string }>,
      fallbackUserId: "",
    },
    commissions: {
      enabled: false,
    },
  },
} as const;

export type ClientConfig = typeof clientConfig;
