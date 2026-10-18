import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";

async function context(id: string) {
  const { user } = await getAuthenticatedUser();
  if (!user || !user.isActive || !["staff", "admin", "super_admin"].includes(user.role)) return { error: NextResponse.json({ error: "Staff access required." }, { status: 403 }) };
  const db = createServiceClient();
  if (!db) return { error: NextResponse.json({ error: "Service unavailable." }, { status: 500 }) };
  const { data: profile, error } = await db.from("traveller_profiles").select("id").eq("briitely_contact_id", id).maybeSingle();
  if (error) return { error: NextResponse.json({ error: "Could not load traveller." }, { status: 500 }) };
  return { db, profile };
}
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await context(id);
  if (ctx.error) return ctx.error;
  if (!ctx.profile) return NextResponse.json({ preferredSuppliers: "", loyaltyPrograms: "" });
  const { data, error } = await ctx.db!.from("traveller_travel_preferences").select("preferred_suppliers,loyalty_programs").eq("traveller_profile_id", ctx.profile.id).maybeSingle();
  if (error) return NextResponse.json({ error: "Could not load preferences." }, { status: 500 });
  return NextResponse.json({ preferredSuppliers: data?.preferred_suppliers ?? "", loyaltyPrograms: data?.loyalty_programs ?? "" });
}
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await context(id);
  if (ctx.error) return ctx.error;
  if (!ctx.profile) return NextResponse.json({ error: "Traveller profile not found. Open Identity Details first." }, { status: 404 });
  const body = await request.json().catch(() => null) as { preferredSuppliers?: unknown; loyaltyPrograms?: unknown } | null;
  if (!body || typeof body.preferredSuppliers !== "string" || typeof body.loyaltyPrograms !== "string" || body.preferredSuppliers.length > 5000 || body.loyaltyPrograms.length > 5000) return NextResponse.json({ error: "Please review both fields." }, { status: 400 });
  const { error } = await ctx.db!.from("traveller_travel_preferences").upsert({ traveller_profile_id: ctx.profile.id, preferred_suppliers: body.preferredSuppliers.trim(), loyalty_programs: body.loyaltyPrograms.trim(), updated_at: new Date().toISOString() }, { onConflict: "traveller_profile_id" });
  if (error) return NextResponse.json({ error: "Could not save preferences." }, { status: 500 });
  return NextResponse.json({ preferredSuppliers: body.preferredSuppliers.trim(), loyaltyPrograms: body.loyaltyPrograms.trim() });
}
