import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const supabase = await createClient();

  // The profiles schema has roles: super_admin, admin, staff.
  // There is no dedicated "advisor" role/capability field — all active
  // staff and admin profiles are eligible to be assigned as advisors.
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("is_active", true)
    .in("role", ["staff", "admin", "super_admin"])
    .order("full_name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to load advisors." }, { status: 500 });
  }

  return NextResponse.json({ advisors: data ?? [] });
}
