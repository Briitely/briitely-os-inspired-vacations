import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/auth";
import { getContactFieldDefinitions } from "@/lib/briitely/contact-custom-fields";

/* The account's Briitely contact custom fields, for Business Settings → Customer File Fields. Admins only. */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "You do not have permission to view settings." }, { status: 403 });
  try {
    const fields = await getContactFieldDefinitions();
    return NextResponse.json({ fields: fields.map(({ id, name, dataType }) => ({ id, name, dataType })) });
  } catch {
    return NextResponse.json({ error: "We couldn't load the custom fields from Briitely. Please try again." }, { status: 502 });
  }
}
