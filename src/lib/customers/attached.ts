import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

type Db = SupabaseClient;

async function count(db: Db, table: string, column: string, value: string): Promise<number> {
  const { count: total, error } = await db.from(table).select("*", { count: "exact", head: true }).eq(column, value);
  if (error) {
    if (error.code === "42P01") return 0; // table not in this database
    throw error;
  }
  return total ?? 0;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Everything that would be lost or left pointing at nothing if this client were deleted. */
export async function attachedTo(db: Db, contactId: string): Promise<{ attached: string[]; travellerProfileId: string | null }> {
  const { data: profile, error } = await db.from("traveller_profiles").select("id, passport_number").eq("briitely_contact_id", contactId).maybeSingle();
  if (error && error.code !== "42P01") throw error;
  const profileId = (profile?.id as string | undefined) ?? null;

  const [files, referredDirect, referredRevenue, bookings, commissions, familyAsPrimary] = await Promise.all([
    count(db, "travel_files", "briitely_contact_id", contactId),
    count(db, "referral_attribution", "direct_referrer_contact_id", contactId),
    count(db, "referral_attribution", "revenue_referrer_contact_id", contactId),
    count(db, "consultation_booking_reviews", "contact_id", contactId),
    count(db, "invoice_commissions", "contact_id", contactId),
    count(db, "client_relationships", "primary_contact_id", contactId),
  ]);
  const [onTrips, familyAsRelated, cards, proposals] = profileId
    ? await Promise.all([
        count(db, "travel_file_travellers", "traveller_profile_id", profileId),
        count(db, "client_relationships", "related_traveller_id", profileId),
        count(db, "traveller_saved_card_references", "traveller_profile_id", profileId),
        count(db, "proposal_travel_information_submissions", "primary_traveller_profile_id", profileId),
      ])
    : [0, 0, 0, 0];

  const attached: string[] = [];
  if (files) attached.push(plural(files, "travel file"));
  if (onTrips) attached.push(`a traveller on ${plural(onTrips, "trip")}`);
  if (familyAsPrimary + familyAsRelated) attached.push(plural(familyAsPrimary + familyAsRelated, "family link"));
  if (referredDirect + referredRevenue) attached.push(`the referrer for ${plural(referredDirect + referredRevenue, "client")}`);
  if (bookings) attached.push(plural(bookings, "consultation booking"));
  if (cards) attached.push(plural(cards, "saved card"));
  if (proposals) attached.push(plural(proposals, "proposal submission"));
  if (commissions) attached.push(plural(commissions, "commission record"));
  if (profile?.passport_number) attached.push("passport details");
  return { attached, travellerProfileId: profileId };
}

