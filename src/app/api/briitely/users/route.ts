import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/auth";
import { getBriitelyUsersWithFallback } from "@/lib/briitely/users";

export async function GET() {
  const { user, error: authError } = await requireAdmin();

  if (authError || !user) {
    return NextResponse.json({ error: "You do not have permission to perform this action." }, { status: 403 });
  }

  try {
    const { users, fallback } = await getBriitelyUsersWithFallback();
    return NextResponse.json({ users, fallback });
  } catch (err) {
    console.error("BRIITELY_USERS_API_ERROR", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "We couldn't load the Briitely user list. Please try again." }, { status: 502 });
  }
}
