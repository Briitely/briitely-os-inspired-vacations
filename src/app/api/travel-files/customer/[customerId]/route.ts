import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ customerId: string }> }
) {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { customerId } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("travel_files")
    .select(`
      id,
      destination,
      stage,
      departure_date,
      file_status,
      current_action:travel_actions!current_action_id (title)
    `)
    .eq("briitely_contact_id", customerId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to load Travel Files." },
      { status: 500 }
    );
  }

  return NextResponse.json({ files: data ?? [] });
}
