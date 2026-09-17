import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

type Profile = {
  briitely_contact_id: string | null;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  email: string | null;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ travelFileId: string }> },
) {
  const { user } = await getAuthenticatedUser();
  if (!user || !user.isActive) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { travelFileId } = await params;
  const db = await createClient();
  const { data, error } = await db
    .from("travel_file_travellers")
    .select("id,traveller_role,receive_trip_communications,traveller_profiles:traveller_profile_id(briitely_contact_id,first_name,last_name,preferred_name,email)")
    .eq("travel_file_id", travelFileId)
    .eq("receive_trip_communications", true)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Could not load trip communication recipients." }, { status: 500 });
  }

  const recipients = (data ?? []).flatMap((member) => {
    const profile = (Array.isArray(member.traveller_profiles)
      ? member.traveller_profiles[0]
      : member.traveller_profiles) as Profile | null;
    if (!profile?.email?.trim()) return [];
    const name = [profile.preferred_name || profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Traveller";
    return [{
      partyMemberId: member.id,
      contactId: profile.briitely_contact_id,
      name,
      email: profile.email.trim(),
      isPrimary: member.traveller_role === "primary",
    }];
  });

  return NextResponse.json({ recipients });
}
