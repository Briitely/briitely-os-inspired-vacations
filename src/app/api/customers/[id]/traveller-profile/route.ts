import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { getContact } from "@/lib/briitely/contacts";

const PROFILE_FIELDS = "id, briitely_contact_id, first_name, middle_name, last_name, preferred_name, date_of_birth, email, phone, passport_number, passport_country, passport_issue_date, passport_expiry_date, emergency_contact_name, emergency_contact_relationship, emergency_contact_phone, emergency_contact_email";

async function requireUser() {
  const { user, error } = await getAuthenticatedUser();
  if (error || !user) return null;
  return user;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const supabase = await createClient();

  const { data: existing, error } = await supabase.from("traveller_profiles").select(PROFILE_FIELDS).eq("briitely_contact_id", id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (existing) return NextResponse.json({ profile: existing });

  try {
    const contact = await getContact(id);
    const { data, error: insertError } = await supabase.from("traveller_profiles").insert({
      briitely_contact_id: contact.id,
      first_name: contact.firstName || "Unknown",
      last_name: contact.lastName || "",
      email: contact.email || null,
      phone: contact.phone || null,
    }).select(PROFILE_FIELDS).single();
    if (insertError || !data) throw new Error(insertError?.message ?? "Could not create traveller profile.");
    return NextResponse.json({ profile: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not load traveller profile." }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const text = (key: string) => typeof body[key] === "string" && body[key] ? String(body[key]).trim() : null;
  const supabase = await createClient();

  try {
    const contact = await getContact(id);
    const { data, error } = await supabase.from("traveller_profiles").upsert({
      briitely_contact_id: id,
      first_name: text("firstName") || contact.firstName || "Unknown",
      middle_name: text("middleName"),
      last_name: text("lastName") || contact.lastName || "",
      preferred_name: text("preferredName"),
      date_of_birth: text("dateOfBirth"),
      email: contact.email || text("email"),
      phone: contact.phone || text("phone"),
      passport_number: text("passportNumber"),
      passport_country: text("passportCountry"),
      passport_issue_date: text("passportIssueDate"),
      passport_expiry_date: text("passportExpiryDate"),
      emergency_contact_name: text("emergencyContactName"),
      emergency_contact_relationship: text("emergencyContactRelationship"),
      emergency_contact_phone: text("emergencyContactPhone"),
      emergency_contact_email: text("emergencyContactEmail"),
    }, { onConflict: "briitely_contact_id" }).select(PROFILE_FIELDS).single();

    if (error || !data) throw new Error(error?.message ?? "Could not save traveller details.");
    return NextResponse.json({ profile: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not save traveller details." }, { status: 500 });
  }
}
