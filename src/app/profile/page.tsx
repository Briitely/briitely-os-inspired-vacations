import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { ProfileSettingsForm } from "@/components/app/profile-settings-form";
import { Button } from "@/components/core/ui/button";

export default async function ProfilePage() {
  const auth = await requireAuthenticatedUser();
  if (!auth) redirect("/login");
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name,last_name,full_name,email,sender_email")
    .eq("id", auth.user.id)
    .single();

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <Button asChild variant="ghost" className="-ml-3 w-fit">
        <Link href="/dashboard"><ArrowLeft className="mr-2 h-4 w-4"/>Return to Dashboard</Link>
      </Button>
      <div>
        <h1 className="text-2xl font-bold">My Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your account and the email account used when preparing client communications.</p>
      </div>
      <ProfileSettingsForm
        firstName={profile?.first_name ?? auth.user.firstName}
        lastName={profile?.last_name ?? auth.user.lastName}
        loginEmail={auth.user.email}
        senderEmail={profile?.sender_email ?? auth.user.email}
      />
    </main>
  );
}
