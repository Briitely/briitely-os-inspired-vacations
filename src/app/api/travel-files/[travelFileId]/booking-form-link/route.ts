import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import {
  BOOKING_FORM_TTL_DAYS,
  getBookingFormBaseUrl,
  hashBookingFormToken,
  newBookingFormToken,
} from "@/lib/travel/booking-form";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ travelFileId: string }> }
) {
  const { user, error: authError } = await getAuthenticatedUser();
  if (authError || !user || !user.isActive) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { travelFileId } = await params;
  const supabase = await createClient();
  const { data: file, error: fileError } = await supabase
    .from("travel_files")
    .select("id")
    .eq("id", travelFileId)
    .maybeSingle();

  if (fileError || !file) {
    return NextResponse.json({ error: "Travel File not found." }, { status: 404 });
  }

  const token = newBookingFormToken();
  const expiresAt = new Date(Date.now() + BOOKING_FORM_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from("booking_form_sessions").insert({
    travel_file_id: travelFileId,
    token_hash: hashBookingFormToken(token),
    expires_at: expiresAt,
    created_by: user.id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    url: `${getBookingFormBaseUrl()}/booking/${encodeURIComponent(token)}`,
    expiresAt,
  });
}
