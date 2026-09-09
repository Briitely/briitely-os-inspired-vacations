import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request, { params }: { params: Promise<{ travelFileId: string }> }) {
  const { user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { travelFileId } = await params;
  const body = await req.json().catch(() => null) as { existingCustomerId?: string; travellerProfileId?: string } | null;
  if (!body?.existingCustomerId && !body?.travellerProfileId) return NextResponse.json({ isDnb: false, dnbReason: null });
  const s = await createClient();
  const { data: file } = await s.from("travel_files").select("id").eq("id", travelFileId).maybeSingle();
  if (!file) return NextResponse.json({ error: "Travel File not found." }, { status: 404 });
  let query = s.from("traveller_profiles").select("id,is_dnb,dnb_reason");
  query = body.travellerProfileId ? query.eq("id", body.travellerProfileId) : query.eq("briitely_contact_id", body.existingCustomerId!);
  const { data, error } = await query.maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ isDnb: Boolean(data?.is_dnb), dnbReason: data?.dnb_reason ?? null });
}
