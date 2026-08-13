import "server-only";

import { briitelyRequest, getLocationId } from "./client";
import { BriitelyApiError } from "./errors";
import type { BriitelyCustomer, BriitelyInvoiceLineInput } from "./types";
import type { TaxRate, TaxType } from "@/lib/tax/types";
import { roundToCents } from "@/lib/tax/rounding";
import type { HighLevelTaxMapping } from "@/config/client.config";

const INVOICE_CREATE_API_VERSION = "v3";
const INVOICE_NUMBER_API_VERSION = "2023-02-21";

export interface HighLevelInvoiceDetails extends HighLevelInvoiceCreateResponse {
  _id?: string;
  name?: string;
  contactId?: string;
  issueDate?: string;
  dueDate?: string;
  amountPaid?: number;
  amountDue?: number;
  balanceDue?: number;
  status?: string;
  businessDetails?: HighLevelBusinessDetails & Record<string, unknown>;
  contactDetails?: HighLevelContactDetails & Record<string, unknown>;
  sentTo?: HighLevelSentTo;
  items?: HighLevelInvoiceItem[];
  invoiceItems?: HighLevelInvoiceItem[];
  discount?: { type?: string; value?: number };
  [key: string]: unknown;
}

export interface HighLevelInvoiceUpdateBody {
  altId: string;
  altType: "location";
  name: string;
  businessDetails: HighLevelBusinessDetails;
  currency: string;
  invoiceItems: HighLevelInvoiceItem[];
  discount: { type: "percentage"; value: 0 };
  contactDetails: HighLevelContactDetails;
  issueDate: string;
  dueDate: string;
  sentTo: HighLevelSentTo;
  liveMode: false;
}

export interface UpdateInvoiceResult {
  invoice: HighLevelInvoiceDetails;
}

export interface GenerateInvoiceNumberResult {
  invoiceNumber: string;
}

export async function generateInvoiceNumber(): Promise<GenerateInvoiceNumberResult> {
  const response = await briitelyRequest<{ invoiceNumber?: string | number }>({
    method: "GET",
    path: "/invoices/generate-invoice-number",
    query: { altId: getLocationId(), altType: "location" },
    version: INVOICE_NUMBER_API_VERSION,
  });

  if (response.invoiceNumber === undefined || response.invoiceNumber === null) {
    throw new BriitelyApiError({
      message: "HighLevel did not return an invoice number.",
      status: 502,
      code: "BRIITELY_INVOICE_NUMBER_MISSING",
      responseBody: JSON.stringify(response),
    });
  }

  return { invoiceNumber: String(response.invoiceNumber) };
}

function toHighLevelDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface HighLevelContactDetails {
  id: string;
  name: string;
  phoneNo: string;
  email: string;
  companyName?: string;
  address?: {
    addressLine1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  };
}

export interface HighLevelBusinessDetails {
  name: string;
}

export interface HighLevelSentTo {
  email: string;
  phoneNo: string;
}

export interface HighLevelInvoiceItemTax {
  _id: string;
  name: string;
  rate: number;
  calculation: "exclusive";
}

export interface HighLevelInvoiceItem {
  name: string;
  description: string;
  productId: string;
  priceId: string;
  currency: string;
  amount: number;
  qty: number;
  taxes: HighLevelInvoiceItemTax[];
  type: "one_time";
  taxInclusive: false;
}

export interface HighLevelInvoiceCreateBody {
  altId: string;
  altType: "location";
  name: string;
  businessDetails: HighLevelBusinessDetails;
  currency: string;
  items: HighLevelInvoiceItem[];
  discount: {
    type: "percentage";
    value: 0;
  };
  contactDetails: HighLevelContactDetails;
  issueDate: string;
  dueDate: string;
  sentTo: HighLevelSentTo;
  liveMode: false;
}

export function buildContactDetails(customer: BriitelyCustomer): HighLevelContactDetails {
  const name = customer.name || [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim();

  const details: HighLevelContactDetails = {
    id: customer.id,
    name,
    phoneNo: customer.phone,
    email: customer.email,
  };

  if (customer.companyName) {
    details.companyName = customer.companyName;
  }

  if (customer.address1) {
    details.address = {
      addressLine1: customer.address1,
      city: customer.city || undefined,
      state: customer.state || undefined,
      postalCode: customer.postalCode || undefined,
    };
  }

  return details;
}

function resolveHighLevelTaxMapping(
  tax: TaxRate,
  highLevelTaxes: Partial<Record<TaxType, HighLevelTaxMapping>>
): HighLevelTaxMapping {
  const mapping = highLevelTaxes[tax.code];
  if (!mapping || !mapping.id || !mapping.name) {
    console.error("HIGHLEVEL_TAX_MAPPING_MISSING", {
      code: tax.code,
      name: tax.name,
      percentage: tax.percentage,
    });
    throw new BriitelyApiError({
      message: `HighLevel tax mapping is not configured for ${tax.name} (${tax.code}). Invoice creation is blocked until this is added to the client configuration.`,
      status: 422,
      code: "HIGHLEVEL_TAX_MAPPING_MISSING",
    });
  }
  if (typeof tax.percentage !== "number" || tax.percentage < 0 || tax.percentage >= 100) {
    console.error("HIGHLEVEL_TAX_PERCENTAGE_INVALID", {
      code: tax.code,
      name: tax.name,
      percentage: tax.percentage,
    });
    throw new BriitelyApiError({
      message: `Tax percentage for ${tax.name} is invalid.`,
      status: 422,
      code: "HIGHLEVEL_TAX_PERCENTAGE_INVALID",
    });
  }
  return mapping;
}

function buildItemTaxes(
  taxes: TaxRate[],
  highLevelTaxes: Partial<Record<TaxType, HighLevelTaxMapping>>
): HighLevelInvoiceItemTax[] {
  return taxes.map((tax) => {
    const mapping = resolveHighLevelTaxMapping(tax, highLevelTaxes);
    return {
      _id: mapping.id,
      name: mapping.name,
      rate: tax.percentage,
      calculation: "exclusive" as const,
    };
  });
}

export async function buildInvoiceCreateBody(
  customer: BriitelyCustomer,
  lines: BriitelyInvoiceLineInput[],
  taxes: TaxRate[],
  highLevelTaxes: Partial<Record<TaxType, HighLevelTaxMapping>>,
  businessDetails: HighLevelBusinessDetails
): Promise<HighLevelInvoiceCreateBody> {
  const issueDate = new Date();
  const dueDate = new Date(issueDate);
  dueDate.setDate(dueDate.getDate() + 14);

  const itemTaxes = buildItemTaxes(taxes, highLevelTaxes);
  const items: HighLevelInvoiceItem[] = lines.map((line) => ({
    name: line.productName,
    description: line.priceName,
    productId: line.productId,
    priceId: line.priceId,
    currency: line.currency || "CAD",
    amount: line.unitPrice,
    qty: line.quantity,
    taxes: itemTaxes,
    type: "one_time",
    taxInclusive: false,
  }));

  return {
    altId: getLocationId(),
    altType: "location",
    name: `Invoice - ${customer.companyName || customer.name || customer.id}`,
    businessDetails: { name: businessDetails.name },
    currency: "CAD",
    items,
    discount: { type: "percentage", value: 0 },
    contactDetails: buildContactDetails(customer),
    issueDate: toHighLevelDateString(issueDate),
    dueDate: toHighLevelDateString(dueDate),
    sentTo: {
      email: customer.email,
      phoneNo: customer.phone,
    },
    liveMode: false,
  };
}

export async function buildInvoiceUpdateBody(
  customer: BriitelyCustomer,
  lines: BriitelyInvoiceLineInput[],
  taxes: TaxRate[],
  highLevelTaxes: Partial<Record<TaxType, HighLevelTaxMapping>>,
  businessDetails: HighLevelBusinessDetails,
  dates?: { issueDate?: string; dueDate?: string }
): Promise<HighLevelInvoiceUpdateBody> {
  const { items, ...rest } = await buildInvoiceCreateBody(customer, lines, taxes, highLevelTaxes, businessDetails);
  return {
    ...rest,
    invoiceItems: items,
    ...(dates?.issueDate ? { issueDate: dates.issueDate } : {}),
    ...(dates?.dueDate ? { dueDate: dates.dueDate } : {}),
  };
}

export interface HighLevelInvoiceCreateResponse {
  id?: string;
  _id?: string;
  invoiceNumber?: string | number;
  status?: string;
  total?: number;
  currency?: string;
}

export interface CreateInvoiceResult {
  invoiceId: string;
  invoiceNumber: string;
  status: string;
  total: number;
  currency: string;
}

export async function createInvoice(
  customer: BriitelyCustomer,
  lines: BriitelyInvoiceLineInput[],
  taxes: TaxRate[],
  highLevelTaxes: Partial<Record<TaxType, HighLevelTaxMapping>>,
  businessDetails: HighLevelBusinessDetails
): Promise<CreateInvoiceResult> {
  if (!customer.id) {
    throw new BriitelyApiError({
      message: "Customer ID is required to create an invoice.",
      status: 400,
      code: "BRIITELY_INVOICE_MISSING_CONTACT",
    });
  }

  if (lines.length === 0) {
    throw new BriitelyApiError({
      message: "At least one invoice line is required.",
      status: 400,
      code: "BRIITELY_INVOICE_NO_LINES",
    });
  }

  for (const line of lines) {
    if (line.quantity <= 0) {
      throw new BriitelyApiError({
        message: "Quantity must be greater than zero.",
        status: 400,
        code: "BRIITELY_INVOICE_INVALID_QUANTITY",
      });
    }
    if (line.unitPrice < 0) {
      throw new BriitelyApiError({
        message: "Unit price cannot be negative.",
        status: 400,
        code: "BRIITELY_INVOICE_INVALID_PRICE",
      });
    }
  }

  const body = await buildInvoiceCreateBody(customer, lines, taxes, highLevelTaxes, businessDetails);

  const firstItem = body.items[0];
  console.info("INVOICE_CREATE_REQUEST", {
    version: INVOICE_CREATE_API_VERSION,
    fieldNames: Object.keys(body),
    itemFields: body.items.length > 0 ? Object.keys(body.items[0]) : [],
    taxObjectFields: firstItem?.taxes.length ? Object.keys(firstItem.taxes[0]) : [],
    itemCount: body.items.length,
    taxesPerItem: firstItem?.taxes.length ?? 0,
    taxNames: body.items.flatMap((item) => item.taxes.map((t) => t.name)),
    taxRates: body.items.flatMap((item) => item.taxes.map((t) => t.rate)),
    taxIds: body.items.flatMap((item) => item.taxes.map((t) => t._id)),
    businessDetailsExists: Boolean(body.businessDetails),
    sentToExists: Boolean(body.sentTo),
    contactDetailsHasAddress: Boolean(body.contactDetails.address),
    contactDetailsAddressLine1: body.contactDetails.address?.addressLine1 ?? null,
    currency: body.currency,
    amount: body.items.reduce((sum, item) => sum + item.amount * item.qty, 0),
    issueDate: body.issueDate,
    dueDate: body.dueDate,
    taxCount: taxes.length,
  });

  const response = await briitelyRequest<HighLevelInvoiceCreateResponse>({
    method: "POST",
    path: "/invoices/",
    body,
    version: INVOICE_CREATE_API_VERSION,
  });

  const invoiceId = response.id ?? response._id ?? "";
  if (!invoiceId) {
    throw new BriitelyApiError({
      message: "HighLevel created the invoice but did not return an invoice ID.",
      status: 502,
      code: "BRIITELY_INVOICE_ID_MISSING",
      responseBody: JSON.stringify(response),
    });
  }

  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const taxTotal = roundToCents(
    lines.reduce(
      (sum, line) =>
        sum + taxes.reduce(
          (taxTotalForLine, tax) =>
            taxTotalForLine + roundToCents(line.unitPrice * line.quantity * tax.rate),
          0
        ),
      0
    )
  );

  return {
    invoiceId,
    invoiceNumber: response.invoiceNumber === undefined ? "" : String(response.invoiceNumber),
    status: response.status ?? "draft",
    total: response.total ?? roundToCents(subtotal + taxTotal),
    currency: response.currency ?? "CAD",
  };
}
