import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/supabase/auth";
import { isBriitelyTestAccount, isTestEnvironment } from "@/lib/environment";
import { upsertContact } from "@/lib/briitely/contacts";
import { briitelyRequest } from "@/lib/briitely/client";
import { logActivity } from "@/lib/logging/activity";

/*
 * Adds fake clients to the Briitely test sub-account, tagged "Sample Data",
 * so a new test environment has clients to work with. Super Admin only, and
 * only in a test build connected to a test sub-account. Safe to run twice:
 * the same email updates the same contact.
 */

const SAMPLE_TAG = "Sample Data";

const SAMPLES = [
  { firstName: "Avery", lastName: "Sample", email: "avery.sample@example.com", phone: "4035550101", city: "Lethbridge" },
  { firstName: "Jordan", lastName: "Testwell", email: "jordan.testwell@example.com", phone: "4035550102", city: "Calgary" },
  { firstName: "Morgan", lastName: "Demo", companyName: "Demo Supply Co.", email: "morgan.demo@example.com", phone: "4035550103", city: "Lethbridge" },
  { firstName: "Riley", lastName: "Example", email: "riley.example@example.com", phone: "4035550104", city: "Medicine Hat" },
  { firstName: "Casey", lastName: "Placeholder", companyName: "Placeholder Events Ltd.", email: "casey.placeholder@example.com", phone: "4035550105", city: "Red Deer" },
  { firstName: "Taylor", lastName: "Trial", email: "taylor.trial@example.com", phone: "4035550106", city: "Edmonton" },
];

export async function POST() {
  const superAdmin = await requireSuperAdmin();
  if (!superAdmin) return NextResponse.json({ error: "Only a Super Admin can add sample clients." }, { status: 403 });
  if (!isTestEnvironment() || !isBriitelyTestAccount()) {
    return NextResponse.json({ error: "Sample clients can only be added in the test environment, connected to a Briitely test sub-account." }, { status: 409 });
  }

  let added = 0;
  for (const sample of SAMPLES) {
    try {
      const { customer } = await upsertContact({ companyName: "", address1: "", state: "AB", postalCode: "", country: "CA", ...sample });
      await briitelyRequest({ method: "POST", path: `/contacts/${encodeURIComponent(customer.id)}/tags`, body: { tags: [SAMPLE_TAG] } }).catch(() => {});
      added += 1;
    } catch {
      // Keep going; the count tells the admin how many made it.
    }
  }
  await logActivity(superAdmin.user.id, { action: "test.sampleClients.added", entityType: "customer", metadata: { added } }).catch(() => {});
  if (!added) return NextResponse.json({ error: "Briitely didn't add the sample clients. Please try again." }, { status: 502 });
  return NextResponse.json({ added, total: SAMPLES.length });
}
