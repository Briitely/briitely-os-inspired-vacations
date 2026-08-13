export type CanadianProvinceCode =
  | "AB"
  | "BC"
  | "MB"
  | "NB"
  | "NL"
  | "NS"
  | "NT"
  | "NU"
  | "ON"
  | "PE"
  | "QC"
  | "SK"
  | "YT";

export type TaxType = "GST" | "HST" | "BC_PST" | "SK_PST" | "MB_RST" | "QC_QST";

export interface TaxRate {
  code: TaxType;
  name: string;
  rate: number;
  percentage: number;
}

export interface TaxJurisdictionResult {
  jurisdiction: CanadianProvinceCode;
  taxes: TaxRate[];
}

export interface TaxLineItem {
  amount: number;
  quantity: number;
  taxable: boolean;
}

export interface ClientTaxConfig {
  country: "CA";
  basis: "destination";
  registrations: {
    GST_HST: boolean;
    BC_PST: boolean;
    SK_PST: boolean;
    MB_RST: boolean;
    QC_QST: boolean;
  };
}

export interface TaxCalculationResult {
  jurisdiction: CanadianProvinceCode;
  taxes: TaxRate[];
  subtotal: number;
  taxTotal: number;
  total: number;
  lineTaxes: TaxLineTaxResult[];
}

export interface TaxLineTaxResult {
  tax: TaxRate;
  amount: number;
}

export type TaxErrorCode =
  | "MISSING_COUNTRY"
  | "UNSUPPORTED_COUNTRY"
  | "MISSING_PROVINCE"
  | "UNRECOGNIZED_PROVINCE";

export interface TaxError {
  code: TaxErrorCode;
  message: string;
}

export type TaxResult =
  | { success: true; value: TaxCalculationResult }
  | { success: false; error: TaxError };
