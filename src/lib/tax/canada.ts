import type { CanadianProvinceCode, TaxRate, TaxType, ClientTaxConfig } from "./types";

const COUNTRY_ALIASES: Record<string, "CA"> = {
  ca: "CA",
  can: "CA",
  canada: "CA",
};

export function normalizeCountry(raw: string): "CA" | null {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase();
  if (!cleaned) return null;
  return COUNTRY_ALIASES[cleaned] ?? null;
}

const PROVINCE_ALIASES: Record<string, CanadianProvinceCode> = {
  alberta: "AB",
  ab: "AB",
  alta: "AB",
  "british columbia": "BC",
  bc: "BC",
  manitoba: "MB",
  mb: "MB",
  "new brunswick": "NB",
  nb: "NB",
  "newfoundland and labrador": "NL",
  "newfoundland": "NL",
  "newfoundland & labrador": "NL",
  nl: "NL",
  "nova scotia": "NS",
  ns: "NS",
  "northwest territories": "NT",
  nt: "NT",
  nunavut: "NU",
  nu: "NU",
  ontario: "ON",
  on: "ON",
  "prince edward island": "PE",
  pe: "PE",
  "pei": "PE",
  quebec: "QC",
  qc: "QC",
  "québec": "QC",
  saskatchewan: "SK",
  sk: "SK",
  yukon: "YT",
  yt: "YT",
};

export function normalizeProvince(raw: string): CanadianProvinceCode | null {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase().replace(/\.$/, "");
  if (!cleaned) return null;
  return PROVINCE_ALIASES[cleaned] ?? null;
}

const GST: TaxRate = { code: "GST", name: "GST", rate: 0.05, percentage: 5 };

const HST_RATES: Record<string, TaxRate> = {
  ON: { code: "HST", name: "HST", rate: 0.13, percentage: 13 },
  NS: { code: "HST", name: "HST", rate: 0.14, percentage: 14 },
  NB: { code: "HST", name: "HST", rate: 0.15, percentage: 15 },
  NL: { code: "HST", name: "HST", rate: 0.15, percentage: 15 },
  PE: { code: "HST", name: "HST", rate: 0.15, percentage: 15 },
};

const GST_ONLY_PROVINCES: CanadianProvinceCode[] = ["AB", "BC", "MB", "QC", "SK", "YT", "NT", "NU"];

const PROVINCIAL_TAX_RATES: Record<string, TaxRate> = {
  BC_PST: { code: "BC_PST", name: "BC PST", rate: 0.07, percentage: 7 },
  SK_PST: { code: "SK_PST", name: "SK PST", rate: 0.06, percentage: 6 },
  MB_RST: { code: "MB_RST", name: "MB RST", rate: 0.07, percentage: 7 },
  QC_QST: { code: "QC_QST", name: "QST", rate: 0.09975, percentage: 9.975 },
};

const PROVINCIAL_TAX_PROVINCE_MAP: Record<string, keyof ClientTaxConfig["registrations"]> = {
  BC: "BC_PST",
  SK: "SK_PST",
  MB: "MB_RST",
  QC: "QC_QST",
};

export function getBaseTaxes(
  province: CanadianProvinceCode,
  gstHstRegistered: boolean
): TaxRate[] {
  if (!gstHstRegistered) {
    return [];
  }
  if (province in HST_RATES) {
    return [HST_RATES[province]];
  }
  if (GST_ONLY_PROVINCES.includes(province)) {
    return [GST];
  }
  return [GST];
}

export function getProvincialTaxes(
  province: CanadianProvinceCode,
  registrations: ClientTaxConfig["registrations"]
): TaxRate[] {
  const regKey = PROVINCIAL_TAX_PROVINCE_MAP[province];
  if (!regKey || !registrations[regKey]) {
    return [];
  }
  const rate = PROVINCIAL_TAX_RATES[regKey];
  return rate ? [rate] : [];
}

export function getJurisdictionTaxes(
  province: CanadianProvinceCode,
  registrations: ClientTaxConfig["registrations"]
): TaxRate[] {
  return [
    ...getBaseTaxes(province, registrations.GST_HST),
    ...getProvincialTaxes(province, registrations),
  ];
}
