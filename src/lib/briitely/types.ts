import { normalizeHighLevelPriceAmount } from "./pricing";

export interface BriitelyCustomer {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  companyName: string;
  email: string;
  phone: string;
  address1: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  assignedUserId?: string;
}

export interface BriitelyInvoiceSummary {
  id: string;
  number: string;
  customerId: string;
  issueDate: string;
  total: number;
  amountPaid: number;
  amountDue: number;
  status: string;
  currency: string;
}

export type PaymentMethod = "cheque" | "e_transfer";

export interface BriitelyContactSearchResult {
  customers: BriitelyCustomer[];
  total: number;
  queryType: string;
  searchCount: number;
}

export interface BriitelyContactUpsertInput {
  firstName: string;
  lastName: string;
  companyName?: string;
  email?: string;
  phone?: string;
  address1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface BriitelyContactUpsertResult {
  customer: BriitelyCustomer;
  created: boolean;
}

interface HighLevelContactEmail {
  email: string;
  type?: string;
}

interface HighLevelContactPhone {
  phone: string;
  type?: string;
}

interface HighLevelContactAddress {
  address1?: string;
  line1?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

interface HighLevelContact {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  address1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  assignedTo?: string;
  emailList?: HighLevelContactEmail[];
  phoneList?: HighLevelContactPhone[];
  contactDetails?: {
    email?: string;
    phone?: string;
  };
  address?: HighLevelContactAddress;
  tags?: string[];
}

interface HighLevelSearchResponse {
  contacts?: HighLevelContact[];
  count?: number;
  totalCount?: number;
}

interface HighLevelUpsertResponse {
  contact?: HighLevelContact;
  contacts?: HighLevelContact[];
  id?: string;
  duplicate?: boolean;
}

function getStreetAddress(contact: HighLevelContact): string {
  const value = contact.address1 ?? contact.address?.address1 ?? contact.address?.line1 ?? contact.address?.addressLine1 ?? "";

  console.info("CONTACT_ADDRESS_MAPPING", {
    topLevelAddress1: contact.address1 ?? null,
    nestedAddress: contact.address ?? null,
    nestedAddress1: contact.address?.address1 ?? null,
    nestedLine1: contact.address?.line1 ?? null,
    nestedAddressLine1: contact.address?.addressLine1 ?? null,
    mappedAddress1: value || null,
    city: contact.city ?? contact.address?.city ?? null,
    state: contact.state ?? contact.address?.state ?? null,
    postalCode: contact.postalCode ?? contact.address?.postalCode ?? null,
  });

  return value;
}

export function mapHighLevelContact(contact: HighLevelContact): BriitelyCustomer {
  const firstName = contact.firstName ?? "";
  const lastName = contact.lastName ?? "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const name = contact.name ?? fullName;
  const companyName = contact.companyName ?? "";

  const email =
    contact.email ??
    contact.emailList?.[0]?.email ??
    contact.contactDetails?.email ??
    "";

  const phone =
    contact.phone ??
    contact.phoneList?.[0]?.phone ??
    contact.contactDetails?.phone ??
    "";

  const address1 = getStreetAddress(contact);
  const city = contact.city ?? contact.address?.city ?? "";
  const state = contact.state ?? contact.address?.state ?? "";
  const postalCode = contact.postalCode ?? contact.address?.postalCode ?? "";
  const country = contact.country ?? contact.address?.country ?? "";

  return {
    id: contact.id,
    firstName,
    lastName,
    name,
    companyName,
    email,
    phone,
    address1,
    city,
    state,
    postalCode,
    country,
    ...(contact.assignedTo?.trim() ? { assignedUserId: contact.assignedTo.trim() } : {}),
  };
}

export function mapHighLevelSearchResponse(
  response: HighLevelSearchResponse,
  queryType: string,
  searchCount: number
): BriitelyContactSearchResult {
  const contacts = response.contacts ?? [];
  return {
    customers: contacts.map(mapHighLevelContact),
    total: response.count ?? response.totalCount ?? contacts.length,
    queryType,
    searchCount,
  };
}

export function mapHighLevelUpsertResponse(
  response: HighLevelUpsertResponse
): BriitelyContactUpsertResult {
  const contact = response.contact ?? response.contacts?.[0];

  if (!contact) {
    throw new Error("HighLevel upsert response did not include a contact.");
  }

  return {
    customer: mapHighLevelContact(contact),
    created: !response.duplicate,
  };
}

export interface BriitelyProduct {
  id: string;
  name: string;
  description: string;
  image: string;
  active: boolean;
}

export interface BriitelyPrice {
  id: string;
  productId: string;
  name: string;
  amount: number;
  currency: string;
  recurring: boolean;
  interval?: string;
  active: boolean;
}

export interface BriitelyProductWithPrices {
  product: BriitelyProduct;
  prices: BriitelyPrice[];
}

export interface BriitelyProductCatalog {
  items: BriitelyProductWithPrices[];
  productCount: number;
  priceCount: number;
  rawProductCount: number;
  archivedProductCount: number;
  priceRequestSuccesses: number;
  priceRequestFailures: number;
  productsWithoutUsablePrices: number;
  status:
    | "PRODUCTS_RETURNED_AND_PRICES_RETURNED"
    | "PRODUCTS_RETURNED_BUT_NO_PRICES"
    | "NO_PRODUCTS_RETURNED"
    | "PRICE_API_FAILED";
}

interface HighLevelProduct {
  _id?: string;
  id?: string;
  name?: string;
  description?: string;
  image?: string;
  archived?: boolean;
  active?: boolean;
  availableInStore?: boolean;
  deleted?: boolean;
  disabled?: boolean;
}

interface HighLevelPrice {
  _id?: string;
  id?: string;
  product?: string | { _id?: string; id?: string };
  productId?: string;
  name?: string;
  amount?: number;
  currency?: string;
  type?: string;
  isActive?: boolean;
  active?: boolean;
  interval?: string;
  recurring?: boolean | { interval?: string };
}

interface HighLevelProductsResponse {
  products: HighLevelProduct[];
  totalCount?: number;
  total?: number;
  hasMore?: boolean;
}

interface HighLevelPricesResponse {
  prices: HighLevelPrice[];
  totalCount?: number;
  total?: number;
  hasMore?: boolean;
}

export function mapHighLevelProduct(product: HighLevelProduct): BriitelyProduct | null {
  const id = product._id?.trim() || product.id?.trim();
  if (!id || product.archived === true || product.deleted === true || product.disabled === true) {
    return null;
  }

  return {
    id,
    name: product.name ?? "",
    description: product.description ?? "",
    image: product.image ?? "",
    active: true,
  };
}

export function mapHighLevelPrice(
  price: HighLevelPrice,
  productId: string
): BriitelyPrice {
  const type = price.type ?? "";
  const recurringObject = typeof price.recurring === "object" && price.recurring !== null
    ? price.recurring
    : null;
  const productValue = typeof price.product === "string"
    ? price.product
    : price.product?._id ?? price.product?.id;

  const rawAmount = price.amount ?? 0;
  const mappedAmount = normalizeHighLevelPriceAmount(rawAmount);

  return {
    id: price._id?.trim() || price.id?.trim() || "",
    productId: price.productId ?? productValue ?? productId,
    name: price.name ?? "",
    amount: mappedAmount,
    currency: price.currency ?? "",
    recurring: recurringObject !== null || price.recurring === true || type === "recurring",
    interval: recurringObject?.interval ?? price.interval,
    active: price.isActive ?? price.active ?? true,
  };
}

export function mapHighLevelProductsResponse(
  response: HighLevelProductsResponse
): BriitelyProduct[] {
  return response.products.map(mapHighLevelProduct).filter((product): product is BriitelyProduct => product !== null);
}

export function mapHighLevelPricesResponse(
  response: HighLevelPricesResponse,
  productId: string
): BriitelyPrice[] {
  return response.prices.map((price) => mapHighLevelPrice(price, productId));
}

export type {
  HighLevelContact,
  HighLevelSearchResponse,
  HighLevelUpsertResponse,
  HighLevelProductsResponse,
  HighLevelPricesResponse,
  HighLevelProduct,
  HighLevelPrice,
};

export interface BriitelyInvoiceLineInput {
  productId: string;
  priceId: string;
  productName: string;
  priceName: string;
  unitPrice: number;
  quantity: number;
  currency: string;
}
