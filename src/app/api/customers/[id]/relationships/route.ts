import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { getContact } from "@/lib/briitely/contacts";

type RelationshipType = "spouse_partner" | "child" | "parent" | "other_family" | "household";

const VALID_RELATIONSHIPS = new Set<RelationshipType>([
  "spouse_partner",
  "child",
  "parent",
  "other_family",
  "household",
]);

function inverseRelationship(type: RelationshipType): RelationshipType {
  if (type === "child") return "parent";
  if (type === "parent") return "child";
  return type;
}

async function requireUser() {
  const { user, error } = await getAuthenticatedUser();
  if (error || !user) return null;
  return user;
}

async function upsertContactTraveller(
  supabase: Awaited<ReturnType<typeof createClient>>,
  contactId: string
) {
  const contact = await getContact(contactId);
  const { data, error } = await supabase
    .from("traveller_profiles")
    .upsert(
      {
        briitely_contact_id: contact.id,
        first_name: contact.firstName || "Unknown",
        last_name: contact.lastName || "",
        email: contact.email || null,
        phone: contact.phone || null,
      },
      { onConflict: "briitely_contact_id" }
    )
    .select("id, briitely_contact_id, first_name, last_name, preferred_name, date_of_birth, email, phone")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Could not save traveller profile.");
  return data;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("client_relationships")
    .select(`
      id,
      relationship_type,
      related_traveller_id,
      traveller_profiles:related_traveller_id (
        id,
        briitely_contact_id,
        first_name,
        last_name,
        preferred_name,
        date_of_birth,
        email,
        phone
      )
    `)
    .eq("primary_contact_id", id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ relationships: data ?? [] });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => null) as {
    relationshipType?: RelationshipType;
    existingCustomerId?: string;
    firstName?: string;
    lastName?: string;
    preferredName?: string;
    dateOfBirth?: string;
    email?: string;
    phone?: string;
  } | null;

  if (!body?.relationshipType || !VALID_RELATIONSHIPS.has(body.relationshipType)) {
    return NextResponse.json({ error: "Choose a valid relationship type." }, { status: 400 });
  }

  if (body.existingCustomerId === id) {
    return NextResponse.json({ error: "A customer cannot be related to themselves." }, { status: 400 });
  }

  const supabase = await createClient();

  try {
    let relatedTraveller;
    if (body.existingCustomerId) {
      relatedTraveller = await upsertContactTraveller(supabase, body.existingCustomerId);
    } else {
      const firstName = body.firstName?.trim();
      const lastName = body.lastName?.trim();
      if (!firstName || !lastName) {
        return NextResponse.json({ error: "First and last name are required." }, { status: 400 });
      }
      const { data, error } = await supabase
        .from("traveller_profiles")
        .insert({
          first_name: firstName,
          last_name: lastName,
          preferred_name: body.preferredName?.trim() || null,
          date_of_birth: body.dateOfBirth || null,
          email: body.email?.trim() || null,
          phone: body.phone?.trim() || null,
        })
        .select("id, briitely_contact_id, first_name, last_name, preferred_name, date_of_birth, email, phone")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Could not create traveller profile.");
      relatedTraveller = data;
    }

    const { data: relationship, error: relationshipError } = await supabase
      .from("client_relationships")
      .upsert(
        {
          primary_contact_id: id,
          related_traveller_id: relatedTraveller.id,
          relationship_type: body.relationshipType,
        },
        { onConflict: "primary_contact_id,related_traveller_id" }
      )
      .select("id, relationship_type, related_traveller_id")
      .single();

    if (relationshipError || !relationship) {
      throw new Error(relationshipError?.message ?? "Could not create relationship.");
    }

    // If the related person is also a Briitely customer, create the inverse relationship
    // so each customer card shows the connection automatically.
    if (relatedTraveller.briitely_contact_id) {
      const primaryTraveller = await upsertContactTraveller(supabase, id);
      await supabase.from("client_relationships").upsert(
        {
          primary_contact_id: relatedTraveller.briitely_contact_id,
          related_traveller_id: primaryTraveller.id,
          relationship_type: inverseRelationship(body.relationshipType),
        },
        { onConflict: "primary_contact_id,related_traveller_id" }
      );
    }

    return NextResponse.json({ relationship }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create relationship." },
      { status: 500 }
    );
  }
}
