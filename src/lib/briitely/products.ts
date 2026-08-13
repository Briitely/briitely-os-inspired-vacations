import "server-only";

import { briitelyRequest, getLocationId } from "./client";
import { BriitelyApiError } from "./errors";
import {
  mapHighLevelPrice,
  mapHighLevelPricesResponse,
  mapHighLevelProductsResponse,
  type BriitelyPrice,
  type BriitelyProduct,
  type BriitelyProductCatalog,
  type BriitelyProductWithPrices,
  type HighLevelPrice,
  type HighLevelPricesResponse,
  type HighLevelProduct,
  type HighLevelProductsResponse,
} from "./types";

const PAGE_LIMIT = 100;
const MAX_PAGES = 100;

type ProductListResult = {
  products: BriitelyProduct[];
  rawProducts: HighLevelProduct[];
  rawProductCount: number;
  archivedProductCount: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function responseMessage(value: unknown): string {
  if (!isRecord(value)) return "Unexpected response format";
  const message = value.message ?? value.error ?? value.statusMessage;
  return typeof message === "string" ? message : "Unexpected response format";
}

function safeErrorBody(error: unknown): string {
  if (error instanceof BriitelyApiError) {
    return error.responseBody.replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]").slice(0, 500);
  }
  return error instanceof Error ? error.message.slice(0, 500) : "Request failed";
}

function parseProductsResponse(value: unknown): HighLevelProductsResponse {
  const source = isRecord(value) && isRecord(value.data) ? value.data : value;
  if (!isRecord(source) || !Array.isArray(source.products)) {
    throw new BriitelyApiError({
      message: "The product service returned an unexpected response.",
      status: 502,
      code: "BRIITELY_PRODUCTS_RESPONSE_INVALID",
      responseBody: responseMessage(value),
    });
  }

  return {
    products: source.products as HighLevelProduct[],
    totalCount: typeof source.totalCount === "number" ? source.totalCount : undefined,
    total: typeof source.total === "number" ? source.total : undefined,
    hasMore: typeof source.hasMore === "boolean" ? source.hasMore : undefined,
  };
}

function parsePricesResponse(value: unknown): HighLevelPricesResponse {
  const source = isRecord(value) && isRecord(value.data) ? value.data : value;
  if (!isRecord(source) || !Array.isArray(source.prices)) {
    throw new BriitelyApiError({
      message: "The price service returned an unexpected response.",
      status: 502,
      code: "BRIITELY_PRICES_RESPONSE_INVALID",
      responseBody: responseMessage(value),
    });
  }

  return {
    prices: source.prices as HighLevelPrice[],
    totalCount: typeof source.totalCount === "number" ? source.totalCount : undefined,
    total: typeof source.total === "number" ? source.total : undefined,
    hasMore: typeof source.hasMore === "boolean" ? source.hasMore : undefined,
  };
}

function resolvedProductId(product: HighLevelProduct): string {
  return product._id?.trim() || product.id?.trim() || "";
}

async function listProductDetails(): Promise<ProductListResult> {
  const locationId = getLocationId();
  const rawProducts: HighLevelProduct[] = [];
  let offset = 0;
  let lastStatus = 200;

  for (let requestNumber = 0; requestNumber < MAX_PAGES; requestNumber++) {
    const rawResponse = await briitelyRequest<unknown>({
      method: "GET",
      path: "/products/",
      query: { locationId, limit: PAGE_LIMIT, offset },
      onResponse: (response) => {
        lastStatus = response.status;
      },
    });
    const response = parseProductsResponse(rawResponse);
    rawProducts.push(...response.products);

    if (response.products.length < PAGE_LIMIT || (response.totalCount ?? response.total) !== undefined && rawProducts.length >= (response.totalCount ?? response.total ?? 0)) {
      break;
    }
    offset += response.products.length;
  }

  console.info("PRODUCT LIST", {
    endpoint: "/products/",
    httpStatus: lastStatus,
    rawProductCount: rawProducts.length,
  });

  rawProducts.forEach((product) => {
    console.info("PRODUCT", {
      name: product.name ?? "",
      rawId: product._id ?? null,
      mappedProductId: resolvedProductId(product) || null,
      idSource: product._id?.trim() ? "_id" : product.id?.trim() ? "id" : "none",
      archived: product.archived ?? null,
      active: product.active ?? null,
      availableInStore: product.availableInStore ?? null,
    });
  });

  return {
    products: mapHighLevelProductsResponse({ products: rawProducts }),
    rawProducts,
    rawProductCount: rawProducts.length,
    archivedProductCount: rawProducts.filter((product) => product.archived === true).length,
  };
}

async function listProductPrices(product: BriitelyProduct, productName: string): Promise<BriitelyPrice[]> {
  const locationId = getLocationId();
  const allPrices: BriitelyPrice[] = [];
  let returnedPriceCount = 0;
  let offset = 0;
  let lastStatus = 200;

  try {
    for (let requestNumber = 0; requestNumber < MAX_PAGES; requestNumber++) {
      const endpoint = `/products/${encodeURIComponent(product.id)}/price/`;
      const rawResponse = await briitelyRequest<unknown>({
        method: "GET",
        path: endpoint,
        query: { locationId, limit: PAGE_LIMIT, offset },
        onResponse: (response) => {
          lastStatus = response.status;
        },
      });
      const response = parsePricesResponse(rawResponse);
      returnedPriceCount += response.prices.length;
      response.prices.forEach((rawPrice) => {
        const mappedPrice = mapHighLevelPrice(rawPrice, product.id);
        console.info("PRICE AMOUNT MAPPING", {
          productName,
          priceName: rawPrice.name ?? "",
          rawHighLevelAmount: rawPrice.amount ?? null,
          mappedUnitPrice: mappedPrice.amount,
          currency: mappedPrice.currency,
        });
      });
      const prices = mapHighLevelPricesResponse(response, product.id).filter(
        (price) =>
          price.id.length > 0 &&
          Number.isFinite(price.amount) &&
          price.currency.length > 0 &&
          price.productId === product.id &&
          price.active !== false
      );
      allPrices.push(...prices);

      if (response.prices.length < PAGE_LIMIT || ((response.totalCount ?? response.total) !== undefined && returnedPriceCount >= (response.totalCount ?? response.total ?? 0))) {
        break;
      }
      offset += response.prices.length;
    }

    console.info("PRICE REQUEST", {
      productName,
      productId: product.id,
      endpoint: `/products/${encodeURIComponent(product.id)}/price/`,
      httpStatus: lastStatus,
      pricesReturned: returnedPriceCount,
      usablePricesReturned: allPrices.length,
    });

    return allPrices;
  } catch (error) {
    console.error("PRICE_API_FAILED", {
      productName,
      productId: product.id,
      endpoint: `/products/${encodeURIComponent(product.id)}/price/`,
      httpStatus: error instanceof BriitelyApiError ? error.status : lastStatus,
      safeErrorBody: safeErrorBody(error),
    });
    throw error;
  }
}

export async function listProductCatalog(): Promise<BriitelyProductCatalog> {
  let productDetails: ProductListResult;
  try {
    productDetails = await listProductDetails();
  } catch (error) {
    console.error("PRODUCT_API_FAILED", {
      endpoint: "/products/",
      httpStatus: error instanceof BriitelyApiError ? error.status : 0,
      safeErrorBody: safeErrorBody(error),
    });
    throw error;
  }

  if (productDetails.rawProductCount === 0) {
    console.info("NO_PRODUCTS_RETURNED");
    return {
      items: [],
      productCount: 0,
      priceCount: 0,
      rawProductCount: 0,
      archivedProductCount: 0,
      priceRequestSuccesses: 0,
      priceRequestFailures: 0,
      productsWithoutUsablePrices: 0,
      status: "NO_PRODUCTS_RETURNED",
    };
  }

  const settled = await Promise.allSettled(
    productDetails.products.map(async (product): Promise<BriitelyProductWithPrices> => ({
      product,
      prices: await listProductPrices(product, product.name),
    }))
  );

  const items: BriitelyProductWithPrices[] = [];
  let priceRequestSuccesses = 0;
  let priceRequestFailures = 0;

  settled.forEach((result) => {
    if (result.status === "fulfilled") {
      priceRequestSuccesses += 1;
      if (result.value.prices.length > 0) items.push(result.value);
    } else {
      priceRequestFailures += 1;
    }
  });

  const priceCount = items.reduce((total, item) => total + item.prices.length, 0);
  const productsWithoutUsablePrices = productDetails.products.length - items.length;
  const status = priceRequestFailures > 0
    ? "PRICE_API_FAILED"
    : priceCount > 0
      ? "PRODUCTS_RETURNED_AND_PRICES_RETURNED"
      : "PRODUCTS_RETURNED_BUT_NO_PRICES";

  console.info(status, {
    rawProductCount: productDetails.rawProductCount,
    archivedProductCount: productDetails.archivedProductCount,
    invoiceEligibleProductCount: productDetails.products.length,
    usablePriceCount: priceCount,
  });

  return {
    items,
    productCount: productDetails.products.length,
    priceCount,
    rawProductCount: productDetails.rawProductCount,
    archivedProductCount: productDetails.archivedProductCount,
    priceRequestSuccesses,
    priceRequestFailures,
    productsWithoutUsablePrices,
    status,
  };
}
