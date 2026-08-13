import { normalizeProvince, normalizeCountry, getJurisdictionTaxes } from "./canada";
import { roundToCents } from "./rounding";
import type {
  CanadianProvinceCode,
  ClientTaxConfig,
  TaxCalculationResult,
  TaxLineItem,
  TaxLineTaxResult,
  TaxRate,
  TaxJurisdictionResult,
  TaxResult,
  TaxError,
} from "./types";

export { normalizeProvince, normalizeCountry, getJurisdictionTaxes, roundToCents };
export type {
  CanadianProvinceCode,
  ClientTaxConfig,
  TaxCalculationResult,
  TaxLineItem,
  TaxLineTaxResult,
  TaxRate,
  TaxJurisdictionResult,
  TaxResult,
  TaxError,
};

export interface CalculateTaxesInput {
  country: string;
  province: string;
  items: TaxLineItem[];
  clientTaxConfig: ClientTaxConfig;
}

export function calculateTaxes(input: CalculateTaxesInput): TaxResult {
  const country = normalizeCountry(input.country);
  if (!country) {
    const errorCode = input.country.trim() ? "UNSUPPORTED_COUNTRY" : "MISSING_COUNTRY";
    const message = input.country.trim()
      ? `Sales tax is not supported for country "${input.country}".`
      : "A country is required to calculate sales tax.";
    return {
      success: false,
      error: { code: errorCode, message },
    };
  }
  if (country !== "CA") {
    return {
      success: false,
      error: { code: "UNSUPPORTED_COUNTRY", message: `Sales tax is not supported for country "${input.country}".` },
    };
  }

  const jurisdiction = normalizeProvince(input.province);
  if (!jurisdiction) {
    if (!input.province || input.province.trim() === "") {
      return {
        success: false,
        error: {
          code: "MISSING_PROVINCE",
          message: "A province is required to calculate sales tax. Please update the customer address.",
        },
      };
    }
    return {
      success: false,
      error: {
        code: "UNRECOGNIZED_PROVINCE",
        message: `We couldn't determine the sales tax for this address. Please check the customer's province.`,
      },
    };
  }

  const taxes = getJurisdictionTaxes(jurisdiction, input.clientTaxConfig.registrations);

  const subtotal = roundToCents(
    input.items.reduce((sum, item) => sum + item.amount * item.quantity, 0)
  );

  const lineTaxes: TaxLineTaxResult[] = [];
  let taxTotal = 0;

  for (const item of input.items) {
    if (!item.taxable) continue;
    const lineAmount = item.amount * item.quantity;
    for (const tax of taxes) {
      const taxAmount = roundToCents(lineAmount * tax.rate);
      taxTotal += taxAmount;
      lineTaxes.push({ tax, amount: taxAmount });
    }
  }

  taxTotal = roundToCents(taxTotal);
  const total = roundToCents(subtotal + taxTotal);

  const value: TaxCalculationResult = {
    jurisdiction,
    taxes,
    subtotal,
    taxTotal,
    total,
    lineTaxes,
  };

  return { success: true, value };
}

export function getProvinceName(code: CanadianProvinceCode): string {
  const names: Record<CanadianProvinceCode, string> = {
    AB: "Alberta",
    BC: "British Columbia",
    MB: "Manitoba",
    NB: "New Brunswick",
    NL: "Newfoundland and Labrador",
    NS: "Nova Scotia",
    NT: "Northwest Territories",
    NU: "Nunavut",
    ON: "Ontario",
    PE: "Prince Edward Island",
    QC: "Quebec",
    SK: "Saskatchewan",
    YT: "Yukon",
  };
  return names[code];
}
