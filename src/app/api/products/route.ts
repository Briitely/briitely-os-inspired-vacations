import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { logIntegration } from "@/lib/logging/integration";
import { listProductCatalog } from "@/lib/briitely/products";
import { toSafeUserMessage, BriitelyApiError } from "@/lib/briitely/errors";

export async function GET() {
  const { user, error: authError } = await getAuthenticatedUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "You must be signed in to view products." },
      { status: 401 }
    );
  }

  try {
    const catalog = await listProductCatalog();

    await Promise.all([
      logIntegration({
        provider: "briitely",
        operation: "products.list",
        status: "success",
        metadata: {
          endpoint: "/products/",
          httpStatus: 200,
          status: catalog.status,
          rawProductCount: catalog.rawProductCount,
          archivedProductCount: catalog.archivedProductCount,
          productCount: catalog.productCount,
          priceCount: catalog.priceCount,
        },
        completedAt: new Date().toISOString(),
      }),
      logIntegration({
        provider: "briitely",
        operation: "product_prices.list",
        status: "success",
        metadata: {
          endpoint: "/products/:productId/price/",
          httpStatus: 200,
          status: catalog.status,
          priceRequestSuccesses: catalog.priceRequestSuccesses,
          priceRequestFailures: catalog.priceRequestFailures,
          productCount: catalog.productCount,
          priceCount: catalog.priceCount,
        },
        completedAt: new Date().toISOString(),
      }),
    ]);

    if (catalog.status === "PRICE_API_FAILED" || catalog.status === "PRODUCTS_RETURNED_BUT_NO_PRICES") {
      return NextResponse.json(
        { error: "We found products but couldn't load their prices. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json(catalog);
  } catch (error) {
    const safeMessage = toSafeUserMessage(error);
    const briitelyError = error instanceof BriitelyApiError ? error : null;

    await logIntegration({
      provider: "briitely",
      operation: "products.list",
      status: "failed",
      errorCode: briitelyError?.code ?? "BRIITELY_UNKNOWN_ERROR",
      errorMessage: safeMessage,
      metadata: {
        endpoint: "/products/",
        httpStatus: briitelyError?.status ?? 0,
      },
      completedAt: new Date().toISOString(),
    });

    await logIntegration({
      provider: "briitely",
      operation: "product_prices.list",
      status: "failed",
      errorCode: briitelyError?.code ?? "BRIITELY_UNKNOWN_ERROR",
      errorMessage: safeMessage,
      metadata: {
        endpoint: "/products/:productId/price/",
        httpStatus: briitelyError?.status ?? 0,
      },
      completedAt: new Date().toISOString(),
    });

    return NextResponse.json(
      { error: "We couldn't load the product list. Please try again." },
      { status: 502 }
    );
  }
}
