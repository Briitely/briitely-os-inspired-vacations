import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { processIntake, validateIntake, type IntakeInput } from "@/lib/travel/intake";

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const input: IntakeInput = {
    firstName: String(body.firstName ?? ""),
    lastName: String(body.lastName ?? ""),
    email: String(body.email ?? ""),
    phone: String(body.phone ?? ""),
    destination: String(body.destination ?? ""),
    tripType: String(body.tripType ?? ""),
    travelTimeframe: String(body.travelTimeframe ?? ""),
    budgetRange: String(body.budgetRange ?? ""),
    numberOfAdults: Number(body.numberOfAdults) || 0,
    numberOfChildren: body.numberOfChildren ? Number(body.numberOfChildren) : null,
    childrenAges: body.childrenAges ? String(body.childrenAges) : null,
    travelInterests: Array.isArray(body.travelInterests) ? body.travelInterests.map(String) : [],
    travelSeasons: Array.isArray(body.travelSeasons) ? body.travelSeasons.map(String) : [],
    lastTravelDestination: body.lastTravelDestination ? String(body.lastTravelDestination) : null,
    lastTravelDate: body.lastTravelDate ? String(body.lastTravelDate) : null,
    referralSource: String(body.referralSource ?? ""),
    referralDetail: body.referralDetail ? String(body.referralDetail) : null,
    eventDetail: body.eventDetail ? String(body.eventDetail) : null,
    specialConsiderations: body.specialConsiderations ? String(body.specialConsiderations) : null,
    consent: Boolean(body.consent ?? true),
    intakeSource: "staff",
    intakeMethod: String(body.intakeMethod ?? "staff"),
    staffNotes: body.staffNotes ? String(body.staffNotes) : null,
    staffUserId: auth.user.id,
  };

  const validation = validateIntake(input);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.errors.join(" ") }, { status: 400 });
  }

  const result = await processIntake(input);

  if (!result.success) {
    return NextResponse.json({ error: result.error ?? "Submission failed." }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    travelFileId: result.travelFileId,
    briitelySyncPending: result.briitelySyncPending,
  });
}
