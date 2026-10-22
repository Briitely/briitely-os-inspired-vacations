import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, CircleAlert, CircleDashed } from "lucide-react";
import { requireSuperAdmin } from "@/lib/supabase/auth";
import { clientConfig } from "@/config/client.config";
import { DashboardHeaderWrapper } from "@/components/app/dashboard-header-wrapper";
import { SharedFooter } from "@/components/app/shared-footer";
import { WorkspaceSection, DetailGroup, DetailItem } from "@/components/core/workspace-section";
import { Badge } from "@/components/core/ui/badge";
import { createServiceClient } from "@/lib/supabase/service";
import { runUserDirectoryChecks } from "@/lib/briitely/user-directory-diagnostics";

export const dynamic = "force-dynamic";

type StatusState = "ready" | "attention" | "optional";

interface StatusItem {
  label: string;
  state: StatusState;
  detail: string;
}

function hasEnv(...names: string[]): boolean {
  return names.some((name) => Boolean(process.env[name]?.trim()));
}

function envItem(label: string, names: string[], readyDetail: string, missingDetail: string, optional = false): StatusItem {
  const configured = hasEnv(...names);
  return { label, state: configured ? "ready" : optional ? "optional" : "attention", detail: configured ? readyDetail : missingDetail };
}

function StatusBadge({ state }: { state: StatusState }) {
  if (state === "ready") return <Badge variant="secondary" className="shrink-0"><CheckCircle2 className="mr-1 h-3 w-3" />Ready</Badge>;
  if (state === "optional") return <Badge variant="outline" className="shrink-0"><CircleDashed className="mr-1 h-3 w-3" />Not set</Badge>;
  return <Badge variant="destructive" className="shrink-0"><CircleAlert className="mr-1 h-3 w-3" />Needs attention</Badge>;
}

function StatusList({ items }: { items: StatusItem[] }) {
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.label} className="flex items-start justify-between gap-6 border-b pb-4 last:border-0 last:pb-0">
          <div className="min-w-0">
            <p className="text-sm font-medium">{item.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
          </div>
          <StatusBadge state={item.state} />
        </div>
      ))}
    </div>
  );
}

export default async function SystemStatusPage() {
  const superAdmin = await requireSuperAdmin();
  if (!superAdmin) redirect("/admin");
  const { user } = superAdmin;
  if (!clientConfig.features.diagnostics.enabled) redirect("/admin");

  const briitelyToken = hasEnv("BRIITELY_PRIVATE_INTEGRATION_TOKEN", "GHL_PRIVATE_INTEGRATION_TOKEN");
  const briitelyLocation = hasEnv("BRIITELY_LOCATION_ID", "GHL_LOCATION_ID");
  const supabasePublic = hasEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL") && hasEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY");

  const serviceClient = createServiceClient();

  let settingsCheck: StatusItem = { label: "Business settings", state: "attention", detail: "Server access to Supabase is not configured" };
  let idempotencyCheck: StatusItem = { label: "Double-submit protection", state: "attention", detail: "Server access to Supabase is not configured" };
  if (serviceClient) {
    const [{ data: settingsRows, error: settingsError }, { error: idempotencyError }] = await Promise.all([
      serviceClient.from("client_settings").select("setting_key").in("setting_key", ["business", "branding"]),
      serviceClient.from("idempotency_records").select("fingerprint", { count: "exact", head: true }),
    ]);
    const keys = new Set((settingsRows ?? []).map((row) => row.setting_key));
    settingsCheck = settingsError
      ? { label: "Business settings", state: "attention", detail: `Could not read client_settings (${settingsError.code ?? "unknown error"})` }
      : keys.has("business")
        ? { label: "Business settings", state: "ready", detail: keys.has("branding") ? "Business and branding settings saved" : "Business settings saved; branding uses the defaults" }
        : { label: "Business settings", state: "attention", detail: "No business settings saved yet. Save them under Admin → Business Settings" };
    idempotencyCheck = idempotencyError
      ? { label: "Double-submit protection", state: "attention", detail: "The idempotency_records table is missing. Run the 20261021180000_core_reliability.sql migration in Supabase" }
      : { label: "Double-submit protection", state: "ready", detail: "Repeated clicks on save buttons are recognised and not saved twice" };
  }

  const platform: StatusItem[] = [
    envItem("Application URL", ["NEXT_PUBLIC_APP_URL"], "Configured", "NEXT_PUBLIC_APP_URL is missing. Links in emails may point to the wrong address"),
    { label: "Supabase", state: supabasePublic ? "ready" : "attention", detail: supabasePublic ? "Public connection configured" : "Public Supabase URL or key is missing" },
    envItem("Supabase server access", ["SUPABASE_SERVICE_ROLE_KEY"], "Server-side privileged access configured", "SUPABASE_SERVICE_ROLE_KEY is missing"),
    settingsCheck,
    idempotencyCheck,
  ];

  const integrations: StatusItem[] = [
    { label: "Briitely connection", state: briitelyToken && briitelyLocation ? "ready" : "attention", detail: briitelyToken && briitelyLocation ? "Token and location configured" : "Briitely token or location ID is missing" },
    hasEnv("BRIITELY_EMAIL_WEBHOOK_URL")
      ? { label: "Sign-in emails", state: "ready", detail: "Standard Briitely email workflow: the dashboard builds the branded email, including the Invitation Contact (BRIITELY_EMAIL_WEBHOOK_URL)" }
      : hasEnv("BRIITELY_AUTH_EMAIL_WEBHOOK_URL")
        ? { label: "Sign-in emails", state: "optional", detail: "Using the older IV sign-in workflow (email written in GHL). Add BRIITELY_EMAIL_WEBHOOK_URL to switch to the standard workflow." }
        : { label: "Sign-in emails", state: "attention", detail: "No email webhook is set, so invitations and password resets can't be sent" },
    envItem("Client trip emails", ["BRIITELY_TRIP_EMAIL_WEBHOOK_URL"], "Client emails and pre-trip emails are sent through Briitely", "BRIITELY_TRIP_EMAIL_WEBHOOK_URL is missing, so client and pre-trip emails can't be sent"),
    envItem("Pre-trip email schedule sync", ["BRIITELY_PRETRIP_EMAIL_SCHEDULE_WEBHOOK_URL"], "Pre-trip email schedules are synced to Briitely", "BRIITELY_PRETRIP_EMAIL_SCHEDULE_WEBHOOK_URL is not set", true),
    envItem("Incoming Briitely webhooks", ["BRIITELY_PORTAL_WEBHOOK_SECRET"], "Inquiries and consultation bookings from Briitely are accepted", "BRIITELY_PORTAL_WEBHOOK_SECRET is missing, so new inquiries and consultation bookings from Briitely are rejected"),
  ];

  const automations: StatusItem[] = [
    envItem("Scheduled jobs", ["CRON_SECRET"], "Daily jobs can run: pre-trip emails, payment reminders, trip lifecycle and inactive inquiries", "CRON_SECRET is missing, so the daily pre-trip email, payment reminder, trip lifecycle and inactive inquiry jobs are refused"),
    envItem("Pre-trip email sending", ["PRETRIP_EMAIL_EXECUTION_SECRET"], "Scheduled pre-trip emails can be sent", "PRETRIP_EMAIL_EXECUTION_SECRET is missing, so scheduled pre-trip emails can't be sent"),
    envItem("Default inquiry owner", ["DEFAULT_INQUIRY_OWNER_PROFILE_ID"], "New inquiries are assigned to the default owner", "DEFAULT_INQUIRY_OWNER_PROFILE_ID is not set", true),
    envItem("Default consultation owner", ["DEFAULT_CONSULTATION_OWNER_PROFILE_ID"], "Consultations without an advisor go to the default owner", "DEFAULT_CONSULTATION_OWNER_PROFILE_ID is not set", true),
  ];

  const directory = briitelyToken && briitelyLocation ? await runUserDirectoryChecks() : null;

  // Preview of automatic linking: match each dashboard profile to a Briitely user by email.
  const directoryByEmail = new Map((directory?.users ?? []).filter((u) => u.email).map((u) => [u.email, u]));
  let profileMatches: Array<{ name: string; email: string; savedId: string | null; matchName: string | null; matchId: string | null }> = [];
  if (serviceClient && directory) {
    const { data: profiles } = await serviceClient
      .from("profiles")
      .select("full_name, email, ghl_user_id")
      .eq("is_active", true)
      .order("full_name", { ascending: true });
    profileMatches = (profiles ?? []).map((profile) => {
      const match = directoryByEmail.get((profile.email ?? "").trim().toLowerCase());
      return {
        name: profile.full_name || profile.email || "Unnamed user",
        email: profile.email ?? "",
        savedId: profile.ghl_user_id ?? null,
        matchName: match?.name ?? null,
        matchId: match?.id ?? null,
      };
    });
  }

  const attentionCount = [...platform, ...integrations, ...automations].filter((item) => item.state === "attention").length;

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeaderWrapper fullName={user.fullName} email={user.email} role={user.role} />

      <main className="workspace-shell space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Admin</span>
          </Link>
        </div>

        <div className="space-y-1">
          <p className="eyebrow">Admin</p>
          <h1 className="font-display text-3xl font-medium tracking-tight">System Status</h1>
          <p className="text-sm text-muted-foreground">
            Configuration health for this dashboard. Secret values are never displayed.
            {attentionCount > 0 ? ` ${attentionCount} ${attentionCount === 1 ? "item needs" : "items need"} attention.` : " Everything required is configured."}
          </p>
        </div>

        <WorkspaceSection eyebrow="Platform" title="Environment" description={`Runtime: ${process.env.NODE_ENV ?? "unknown"}. The app, database and saved settings.`}>
          <StatusList items={platform} />
        </WorkspaceSection>

        <WorkspaceSection eyebrow="Briitely" title="Integrations" description="The Briitely connection and the email workflows and webhooks the dashboard relies on.">
          <StatusList items={integrations} />
        </WorkspaceSection>

        <WorkspaceSection eyebrow="Automations" title="Scheduled Jobs" description="Daily jobs and the default owners used when no advisor is assigned yet.">
          <StatusList items={automations} />
        </WorkspaceSection>

        <WorkspaceSection eyebrow="Briitely" title="Users & Assignment" description="Checks that the Briitely user list can be read and that each dashboard user has a Briitely user with the same email. Nothing is changed.">
          {!directory ? (
            <p className="text-sm text-muted-foreground">Configure the Briitely token and location to run these checks.</p>
          ) : (
            <div className="space-y-8">
              <DetailGroup label="User Directory" columns={2}>
                <DetailItem label="Company ID Resolved" value={directory.companyIdResolved ? "Yes" : "No"} />
                <DetailItem label="Briitely Users Found" value={directory.users.length} />
              </DetailGroup>

              <div className="space-y-3">
                {directory.checks.map((check) => (
                  <div key={check.path} className="flex items-start justify-between gap-6 border-b pb-3 last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{check.label}</p>
                      <p className="text-xs text-muted-foreground">GET {check.path}</p>
                    </div>
                    <div className="flex max-w-[60%] flex-col items-end gap-1">
                      <Badge variant={check.ok ? "secondary" : "destructive"}>
                        {check.ok ? `${check.userCount} users` : `Failed${check.status ? ` (${check.status})` : ""}`}
                      </Badge>
                      {!check.ok && <span className="break-all text-right text-xs text-muted-foreground">{check.detail}</span>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <p className="os-detail-group-label">Dashboard Users Matched by Email</p>
                {profileMatches.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active dashboard users found.</p>
                ) : (
                  profileMatches.map((row) => (
                    <div key={row.email || row.name} className="flex items-start justify-between gap-6 border-b pb-3 last:border-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{row.name}</p>
                        <p className="text-xs text-muted-foreground">{row.email || "—"}</p>
                      </div>
                      <div className="flex max-w-[60%] flex-col items-end gap-1 text-right">
                        <Badge variant={row.matchId ? "secondary" : "destructive"}>
                          {row.matchId ? `Matches ${row.matchName}` : "No Briitely user with this email"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Saved link: {row.savedId ? (row.savedId === row.matchId ? "correct" : "different user") : "none"}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </WorkspaceSection>
      </main>

      <SharedFooter />
    </div>
  );
}
