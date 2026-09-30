import { NextResponse } from "next/server";
import { processIntake, validateIntake, type IntakeInput } from "@/lib/travel/intake";

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function pick(body: Record<string, unknown>, ...keys: string[]): unknown {
  const customData = objectValue(body.customData);
  const contact = objectValue(body.contact);
  for (const key of keys) {
    if (body[key] !== undefined && body[key] !== null) return body[key];
    if (customData[key] !== undefined && customData[key] !== null) return customData[key];
    if (contact[key] !== undefined && contact[key] !== null) return contact[key];
  }
  return undefined;
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function optionalText(value: unknown): string | null {
  const valueText = textValue(value);
  return valueText || null;
}

function listValue(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(textValue).filter(Boolean);
  const valueText = textValue(value);
  if (!valueText) return [];
  return valueText.split(",").map((item) => item.trim()).filter(Boolean);
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function booleanValue(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const normalized = textValue(value).toLowerCase();
  return ["true", "yes", "1", "on", "accepted"].includes(normalized);
}

export async function POST(request: Request) {
  const secret = process.env.BRIITELY_PORTAL_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Server configuration error." }, { status: 500 });

  const providedSecret = request.headers.get("x-briitely-webhook-secret");
  if (!providedSecret || !safeCompare(providedSecret, secret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    const raw = await request.json();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid payload");
    body = raw as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const input: IntakeInput = {
    firstName: textValue(pick(body, "firstName", "first_name")),
    lastName: textValue(pick(body, "lastName", "last_name")),
    email: textValue(pick(body, "email")),
    phone: textValue(pick(body, "phone")),
    destination: textValue(pick(body, "destination")),
    tripType: textValue(pick(body, "tripType", "trip_type")),
    travelTimeframe: textValue(pick(body, "travelTimeframe", "travel_timeframe")),
    budgetRange: textValue(pick(body, "budgetRange", "budget_range")),
    numberOfAdults: numberValue(pick(body, "numberOfAdults", "number_of_adults"), 0),
    numberOfChildren: pick(body, "numberOfChildren", "number_of_children") == null
      ? null
      : numberValue(pick(body, "numberOfChildren", "number_of_children"), 0),
    childrenAges: optionalText(pick(body, "childrenAges", "children_ages")),
    travelInterests: listValue(pick(body, "travelInterests", "travel_interests")),
    travelSeasons: listValue(pick(body, "travelSeasons", "travel_seasons")),
    lastTravelDestination: optionalText(pick(body, "lastTravelDestination", "last_travel_destination")),
    lastTravelDate: optionalText(pick(body, "lastTravelDate", "last_travel_date")),
    referralSource: textValue(pick(body, "referralSource", "referral_source")),
    referralDetail: optionalText(pick(body, "referralDetail", "referral_detail")),
    eventDetail: optionalText(pick(body, "eventDetail", "event_detail")),
    specialConsiderations: optionalText(pick(body, "specialConsiderations", "special_considerations")),
    consent: pick(body, "consent") == null ? true : booleanValue(pick(body, "consent")),
    intakeSource: "website",
    intakeMethod: "website-survey",
    staffNotes: null,
    staffUserId: null,
  };

  console.log("TRAVEL_INQUIRY_WEBHOOK_RECEIVED",{keys:Object.keys(body),customDataKeys:Object.keys(objectValue(body.customData)),contactKeys:Object.keys(objectValue(body.contact)),mapped:{firstName:input.firstName,lastName:input.lastName,email:input.email,phone:input.phone,destination:input.destination,tripType:input.tripType,travelTimeframe:input.travelTimeframe,budgetRange:input.budgetRange,numberOfAdults:input.numberOfAdults,numberOfChildren:input.numberOfChildren,childrenAges:input.childrenAges,travelInterests:input.travelInterests,travelSeasons:input.travelSeasons,lastTravelDestination:input.lastTravelDestination,lastTravelDate:input.lastTravelDate,referralSource:input.referralSource,referralDetail:input.referralDetail,eventDetail:input.eventDetail,specialConsiderations:input.specialConsiderations,consent:input.consent}});

  const validation = validateIntake(input);
  if (!validation.valid) {
    console.error("TRAVEL_INQUIRY_WEBHOOK_VALIDATION_FAILED",{errors:validation.errors,mapped:{firstName:input.firstName,lastName:input.lastName,email:input.email,phone:input.phone,destination:input.destination,tripType:input.tripType,travelTimeframe:input.travelTimeframe,budgetRange:input.budgetRange,numberOfAdults:input.numberOfAdults,numberOfChildren:input.numberOfChildren,childrenAges:input.childrenAges,referralSource:input.referralSource,consent:input.consent}});
    return NextResponse.json({ error: validation.errors.join(" "), errors:validation.errors, result: "validation_failed" }, { status: 400 });
  }

  const result = await processIntake(input);
  if (!result.success) {
    console.error("TRAVEL_INQUIRY_WEBHOOK_PROCESS_FAILED",{error:result.error,briitelyContactId:result.briitelyContactId,briitelySyncPending:result.briitelySyncPending});
    return NextResponse.json({ error: result.error ?? "Submission failed.", result: "failed" }, { status: 500 });
  }
  console.log("TRAVEL_INQUIRY_WEBHOOK_CREATED",{travelFileId:result.travelFileId,briitelyContactId:result.briitelyContactId,briitelySyncPending:result.briitelySyncPending});

  return NextResponse.json({
    success: true,
    result: "travel_file_created",
    travelFileId: result.travelFileId,
    briitelyContactId: result.briitelyContactId,
    briitelySyncPending: result.briitelySyncPending,
  });
}
