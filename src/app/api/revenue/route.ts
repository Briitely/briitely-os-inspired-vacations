import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { getRevenueData } from "@/lib/revenue/getRevenueData";
import { clientConfig } from "@/config/client.config";
import type { RevenueModuleConfig } from "@/lib/revenue/types";

export async function GET() {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: "You must be signed in to view revenue data." },
      { status: 401 }
    );
  }

  if (!clientConfig.revenue?.enabled) {
    return NextResponse.json(
      { error: "Revenue reporting is not enabled." },
      { status: 403 }
    );
  }

  try {
    const revenueConfig: RevenueModuleConfig = {
      enabled: clientConfig.revenue.enabled,
      currency: clientConfig.revenue.currency,
      locale: clientConfig.revenue.locale,
      reportingYearStartMonth: clientConfig.revenue.reportingYearStartMonth,
      invoiceGoLiveDate: clientConfig.invoiceGoLiveDate,
      grouping: {
        type: clientConfig.revenue.grouping.type,
        label: clientConfig.revenue.grouping.label,
        users: [...clientConfig.revenue.grouping.users],
        fallbackUserId: clientConfig.revenue.grouping.fallbackUserId,
      },
      commissions: {
        enabled: clientConfig.revenue.commissions.enabled,
      },
    };

    const data = await getRevenueData(revenueConfig);
    return NextResponse.json(data);
  } catch (error) {
    console.error("REVENUE_API_FAILED", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: "We couldn't load revenue data. Please try again." },
      { status: 502 }
    );
  }
}
