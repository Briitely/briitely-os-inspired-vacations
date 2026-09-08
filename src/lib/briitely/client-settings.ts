import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { clientConfig } from "@/config/client.config";
import type { ClientSetting } from "@/lib/supabase/types";

type SettingValue = Record<string, unknown> | string;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unwrapValue(raw: unknown): SettingValue {
  if (typeof raw === "string") return raw;
  if (isObject(raw)) return raw;
  return {};
}

export async function getClientSettings(): Promise<Record<string, SettingValue>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_settings")
    .select("setting_key, setting_value");

  if (error || !data) {
    return {};
  }

  const result: Record<string, SettingValue> = {};
  for (const row of data as Pick<ClientSetting, "setting_key" | "setting_value">[]) {
    result[row.setting_key] = unwrapValue(row.setting_value);
  }
  return result;
}

export async function getClientSetting(key: string): Promise<SettingValue | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_settings")
    .select("setting_value")
    .eq("setting_key", key)
    .maybeSingle();

  if (error || !data) return null;
  return unwrapValue(data.setting_value);
}

export async function upsertClientSetting(
  key: string,
  value: SettingValue,
  description?: string
): Promise<boolean> {
  const serviceClient = createServiceClient();
  if (!serviceClient) {
    const supabase = await createClient();
    const { error } = await supabase
      .from("client_settings")
      .upsert({ setting_key: key, setting_value: value, description }, { onConflict: "setting_key" });
    return !error;
  }

  const { error } = await serviceClient
    .from("client_settings")
    .upsert({ setting_key: key, setting_value: value, description }, { onConflict: "setting_key" });
  return !error;
}

export interface BusinessSettings {
  businessName: string;
  logoUrl: string;
  phone: string;
  website: string;
  email: string;
  address: {
    street: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
  };
}

export interface RegionalSettings {
  timezone: string;
  currency: string;
  locale: string;
}

export interface InvoiceSettings {
  paymentInstructions: string;
  latePaymentTerms: string;
  defaultSenderUserId: string;
  defaultSenderEmail: string;
}

export function getDefaultBusinessSettings(): BusinessSettings {
  return {
    businessName: clientConfig.identity.name,
    logoUrl: "",
    phone: "",
    website: "",
    email: "",
    address: {
      street: "",
      city: "",
      province: "",
      postalCode: "",
      country: "Canada",
    },
  };
}

export function getDefaultRegionalSettings(): RegionalSettings {
  return {
    timezone: "America/Toronto",
    currency: clientConfig.revenue.currency,
    locale: clientConfig.revenue.locale,
  };
}

export function getDefaultInvoiceSettings(): InvoiceSettings {
  return {
    paymentInstructions: "",
    latePaymentTerms: "",
    defaultSenderUserId: clientConfig.defaultInvoiceSenderUserId,
    defaultSenderEmail: clientConfig.defaultInvoiceSenderEmail,
  };
}

export function getDefaultGoLiveDate(): string {
  return clientConfig.invoiceGoLiveDate;
}

export async function getBusinessSettings(): Promise<BusinessSettings> {
  const defaults = getDefaultBusinessSettings();
  const raw = await getClientSetting("business");
  if (!isObject(raw)) return defaults;
  const addr = isObject(raw.address) ? raw.address : {};
  return {
    businessName: typeof raw.businessName === "string" ? raw.businessName : defaults.businessName,
    logoUrl: typeof raw.logoUrl === "string" ? raw.logoUrl : defaults.logoUrl,
    phone: typeof raw.phone === "string" ? raw.phone : defaults.phone,
    website: typeof raw.website === "string" ? raw.website : defaults.website,
    email: typeof raw.email === "string" ? raw.email : defaults.email,
    address: {
      street: typeof addr.street === "string" ? addr.street : defaults.address.street,
      city: typeof addr.city === "string" ? addr.city : defaults.address.city,
      province: typeof addr.province === "string" ? addr.province : defaults.address.province,
      postalCode: typeof addr.postalCode === "string" ? addr.postalCode : defaults.address.postalCode,
      country: typeof addr.country === "string" ? addr.country : defaults.address.country,
    },
  };
}

export async function getRegionalSettings(): Promise<RegionalSettings> {
  const defaults = getDefaultRegionalSettings();
  const raw = await getClientSetting("regional");
  if (!isObject(raw)) return defaults;
  return {
    timezone: typeof raw.timezone === "string" ? raw.timezone : defaults.timezone,
    currency: typeof raw.currency === "string" ? raw.currency : defaults.currency,
    locale: typeof raw.locale === "string" ? raw.locale : defaults.locale,
  };
}

export async function getInvoiceSettings(): Promise<InvoiceSettings> {
  const defaults = getDefaultInvoiceSettings();
  const raw = await getClientSetting("invoice");
  if (!isObject(raw)) return defaults;
  return {
    paymentInstructions: typeof raw.paymentInstructions === "string" ? raw.paymentInstructions : defaults.paymentInstructions,
    latePaymentTerms: typeof raw.latePaymentTerms === "string" ? raw.latePaymentTerms : defaults.latePaymentTerms,
    defaultSenderUserId: typeof raw.defaultSenderUserId === "string" ? raw.defaultSenderUserId : defaults.defaultSenderUserId,
    defaultSenderEmail: typeof raw.defaultSenderEmail === "string" ? raw.defaultSenderEmail : defaults.defaultSenderEmail,
  };
}

export async function getGoLiveDate(): Promise<string> {
  const raw = await getClientSetting("invoiceGoLiveDate");
  if (typeof raw === "string" && raw) return raw;
  return getDefaultGoLiveDate();
}

export interface BrandingSettings {
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

export function getDefaultBrandingSettings(): BrandingSettings {
  return {
    logoUrl: "",
    primaryColor: "#334155",
    secondaryColor: "#64748b",
    accentColor: "#0ea5e9",
  };
}

function isHexColor(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(value);
}

export async function getBrandingSettings(): Promise<BrandingSettings> {
  const defaults = getDefaultBrandingSettings();
  const raw = await getClientSetting("branding");
  if (!isObject(raw)) return defaults;
  return {
    logoUrl: typeof raw.logoUrl === "string" ? raw.logoUrl : defaults.logoUrl,
    primaryColor: isHexColor(raw.primaryColor) ? raw.primaryColor : defaults.primaryColor,
    secondaryColor: isHexColor(raw.secondaryColor) ? raw.secondaryColor : defaults.secondaryColor,
    accentColor: isHexColor(raw.accentColor) ? raw.accentColor : defaults.accentColor,
  };
}

export function hexToHsl(hex: string): string {
  const cleaned = hex.replace("#", "");
  const full = cleaned.length === 3
    ? cleaned.split("").map((c) => c + c).join("")
    : cleaned;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
