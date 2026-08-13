import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logActivity } from "@/lib/logging/activity";

export async function GET() {
  const { user, error: authError } = await requireAdmin();

  if (authError || !user) {
    return NextResponse.json({ error: "You do not have permission to view settings." }, { status: 403 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_settings")
    .select("setting_key, setting_value, description, updated_at")
    .order("setting_key");

  if (error) {
    return NextResponse.json({ error: "We couldn't load the settings." }, { status: 500 });
  }

  const settings: Record<string, unknown> = {};
  for (const row of data ?? []) {
    settings[row.setting_key] = row.setting_value;
  }

  return NextResponse.json({ settings });
}

interface PutRequestBody {
  key: string;
  value: unknown;
  description?: string;
  confirmGoLive?: boolean;
}

export async function PUT(request: Request) {
  const { user, error: authError } = await requireAdmin();

  if (authError || !user) {
    return NextResponse.json({ error: "You do not have permission to update settings." }, { status: 403 });
  }

  let body: PutRequestBody;
  try {
    body = (await request.json()) as PutRequestBody;
  } catch {
    return NextResponse.json({ error: "We couldn't read that request." }, { status: 400 });
  }

  const key = (body.key ?? "").trim();
  if (!key) {
    return NextResponse.json({ error: "Setting key is required." }, { status: 400 });
  }

  if (key === "invoiceGoLiveDate" && !body.confirmGoLive) {
    return NextResponse.json({ error: "Please confirm the go-live date change before saving." }, { status: 400 });
  }

  const serviceClient = createServiceClient();
  const supabase = await createClient();

  try {
    let error: unknown = null;

    if (serviceClient) {
      const result = await serviceClient
        .from("client_settings")
        .upsert({ setting_key: key, setting_value: body.value, description: body.description }, { onConflict: "setting_key" });
      error = result.error;
    } else {
      const result = await supabase
        .from("client_settings")
        .upsert({ setting_key: key, setting_value: body.value, description: body.description }, { onConflict: "setting_key" });
      error = result.error;
    }

    if (error) {
      console.error("SETTINGS_UPDATE_FAILED", { key, message: (error as { message?: string }).message });
      return NextResponse.json({ error: "We couldn't save the settings. Please try again." }, { status: 500 });
    }

    let action = "settings.updated";
    if (key === "business") action = "business.settings_updated";
    else if (key === "invoice") action = "invoice.settings_updated";
    else if (key === "invoiceGoLiveDate") action = "business.settings_updated";

    await logActivity(user.id, {
      action,
      entityType: "settings",
      externalId: key,
      metadata: { settingKey: key },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong while saving settings." }, { status: 500 });
  }
}
