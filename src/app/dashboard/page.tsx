import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { DashboardHeaderWrapper } from "@/components/app/dashboard-header-wrapper";
import { SharedFooter } from "@/components/app/shared-footer";
import { ClientJourneyDashboard } from "@/components/app/client-journey-dashboard";
import { WorkflowCard } from "@/components/app/workflow-card";
import { createClient } from "@/lib/supabase/server";
import { UserSearch, ShieldCheck, MapPinned } from "lucide-react";
import type { DashboardTravelFile } from "@/lib/travel/queries";

export default async function DashboardPage() {
  const { user, error } = await getAuthenticatedUser();

  if (error || !user) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data: rawFiles } = await supabase
    .from("travel_files")
    .select(`
      *,
      current_action:travel_actions!current_action_id (
        id, travel_file_id, action_code, title, description,
        action_role, responsible_type, responsible_user_id,
        status, due_at, waiting_since, activated_at, completed_at,
        completion_source, completion_event, completed_by,
        escalation_at, escalated_at, superseded_by_action_id,
        notes, metadata, created_at, updated_at
      ),
      assigned_advisor:profiles!assigned_advisor_id (
        id, full_name
      )
    `)
    .eq("file_status", "open")
    .order("created_at", { ascending: false });

  // Fetch responsible user profiles for internal actions
  const internalActionUserIds = (rawFiles ?? [])
    .map((f: Record<string, unknown>) => {
      const action = f.current_action as Record<string, unknown> | null;
      return action?.responsible_type === "internal" ? (action.responsible_user_id as string | null) : null;
    })
    .filter((id): id is string => id !== null);

  let profileMap: Record<string, string> = {};
  if (internalActionUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", [...new Set(internalActionUserIds)]);
    profileMap = Object.fromEntries(
      (profiles ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name])
    );
  }

  const files: DashboardTravelFile[] = (rawFiles ?? []).map((f: Record<string, unknown>) => {
    const action = f.current_action as Record<string, unknown> | null;
    const responsibleUserId = action?.responsible_user_id as string | null;
    return {
      ...(f as unknown as DashboardTravelFile),
      responsible_user:
        responsibleUserId && profileMap[responsibleUserId]
          ? { id: responsibleUserId, full_name: profileMap[responsibleUserId] }
          : null,
    };
  });

  const isAdmin = user.role === "admin" || user.role === "super_admin";

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeaderWrapper
        fullName={user.fullName}
        email={user.email}
        role={user.role}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground">
            Client Journey
          </h2>
          <p className="text-muted-foreground text-base">
            Open Travel Files and their next actions.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <WorkflowCard
            icon={<MapPinned className="h-7 w-7" />}
            title="Client Journey"
            description="View and manage open Travel Files and their next actions."
            href="#client-journey"
            enabled
          />
          <WorkflowCard
            icon={<UserSearch className="h-7 w-7" />}
            title="Find or Create Customer"
            description="Look up an existing customer or add a new one to your records."
            href="/customers"
            enabled
          />
          {(isAdmin) && (
            <WorkflowCard
              icon={<ShieldCheck className="h-7 w-7" />}
              title="Admin"
              description="Manage users, business settings, and system preferences."
              href="/admin"
              enabled
            />
          )}
        </div>

        <div id="client-journey" className="scroll-mt-24">
          <ClientJourneyDashboard
            files={files}
            currentUserId={user.id}
          />
        </div>
      </main>

      <SharedFooter label="Client Journey" />
    </div>
  );
}
