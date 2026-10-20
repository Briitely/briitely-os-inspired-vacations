import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { logActivity } from "@/lib/logging/activity";
import { formatPhoneNumber } from "@/lib/format/phone";

interface ProfileBody { firstName?: string; lastName?: string; phone?: string; }

// Signed-in users update their own name and phone. Nothing else on the profile
// (role, status, email, Briitely link) can be changed here.
export async function PATCH(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error || !user || !user.isActive) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  let body: ProfileBody;
  try { body = await request.json() as ProfileBody; } catch { return NextResponse.json({ error: "We couldn't read that request. Please try again." }, { status: 400 }); }

  const firstName = (body.firstName ?? "").trim();
  const lastName = (body.lastName ?? "").trim();
  const phone = (body.phone ?? "").trim();
  if (!firstName) return NextResponse.json({ error: "First name is required." }, { status: 400 });
  if (!lastName) return NextResponse.json({ error: "Last name is required." }, { status: 400 });
  if (firstName.length > 80 || lastName.length > 80) return NextResponse.json({ error: "Names must be 80 characters or fewer." }, { status: 400 });
  if (phone && !/^[0-9+().\-\s]{7,25}$/.test(phone)) return NextResponse.json({ error: "Enter a phone number using digits, spaces, dashes or brackets." }, { status: 400 });

  const service = createServiceClient();
  if (!service) return NextResponse.json({ error: "We couldn't save your profile. Please try again." }, { status: 503 });

  const { error: updateError } = await service
    .from("profiles")
    .update({ first_name: firstName, last_name: lastName, full_name: `${firstName} ${lastName}`, phone: phone ? formatPhoneNumber(phone) : null })
    .eq("id", user.id);
  if (updateError) {
    console.error("ACCOUNT_PROFILE_UPDATE_FAILED", { userId: user.id, message: updateError.message });
    return NextResponse.json({ error: "We couldn't save your profile. Please try again." }, { status: 500 });
  }

  await logActivity(user.id, { action: "account.profile_updated", entityType: "user", externalId: user.id });
  return NextResponse.json({ success: true });
}
