import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isTestSignInAvailable } from "@/lib/environment";

/* Sign In for Testing (lib/environment.ts): test builds only; signs in as the test account. */
export async function POST() {
  if (!isTestSignInAvailable()) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: process.env.TEST_SIGN_IN_EMAIL!.trim(),
    password: process.env.TEST_SIGN_IN_PASSWORD!,
  });
  if (error || !data.user) {
    return NextResponse.json({ error: "The test account couldn't sign in. Check TEST_SIGN_IN_EMAIL and TEST_SIGN_IN_PASSWORD in Vercel → Preview." }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("is_active").eq("id", data.user.id).maybeSingle();
  if (!profile?.is_active) {
    await supabase.auth.signOut();
    return NextResponse.json({ error: "The test account has no active profile on this dashboard. Invite it from Users & Access first." }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}
