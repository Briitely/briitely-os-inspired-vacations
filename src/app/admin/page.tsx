import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { DashboardHeaderWrapper } from "@/components/app/dashboard-header-wrapper";
import { Card, CardContent } from "@/components/core/ui/card";
import { Users, Settings, BarChart3, Activity, Building2, ArrowLeft, Lock } from "lucide-react";

export default async function AdminHomePage() {
  const { user, error } = await getAuthenticatedUser();

  if (error || !user) {
    redirect("/login");
  }

  if (user.role !== "admin" && user.role !== "super_admin") {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeaderWrapper fullName={user.fullName} email={user.email} role={user.role} />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Dashboard</span>
            </Link>
          </div>
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <Lock className="h-10 w-10 text-muted-foreground mx-auto" />
              <p className="text-base text-foreground font-medium">You do not have permission to access this area.</p>
              <p className="text-sm text-muted-foreground">Please contact an administrator if you believe this is an error.</p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const isSuperAdmin = user.role === "super_admin";

  const cards = [
    {
      icon: <Users className="h-7 w-7" />,
      title: "Users & Access",
      description: "Invite team members and assign roles.",
      href: "/admin/users",
    },
    {
      icon: <Settings className="h-7 w-7" />,
      title: "Business Settings",
      description: "Update your business name, address, logo, and regional preferences.",
      href: "/admin/business",
    },
    {
      icon: <BarChart3 className="h-7 w-7" />,
      title: "Reports",
      description: "Sales, tax, receivables, and commission summaries.",
      href: null,
      comingSoon: true,
    },
  ];

  if (isSuperAdmin) {
    cards.push({
      icon: <Activity className="h-7 w-7" />,
      title: "System Diagnostics",
      description: "View system health and integration status.",
      href: null,
      comingSoon: true,
    } as typeof cards[number]);
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeaderWrapper fullName={user.fullName} email={user.email} role={user.role} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </Link>
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground">Admin Settings</h2>
          <p className="text-muted-foreground text-base">Manage your team and business configuration.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {cards.map((card) => {
            const inner = (
              <Card className={`h-full ${card.comingSoon ? "opacity-60" : ""}`}>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-center h-14 w-14 rounded-lg bg-secondary text-secondary-foreground">
                    {card.icon}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-foreground">{card.title}</h3>
                      {card.comingSoon && (
                        <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">Coming Soon</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{card.description}</p>
                  </div>
                </CardContent>
              </Card>
            );

            if (card.href) {
              return (
                <Link key={card.href} href={card.href} className="block rounded-lg transition-transform hover:-translate-y-0.5">
                  {inner}
                </Link>
              );
            }
            return <div key={card.title}>{inner}</div>;
          })}
        </div>
      </main>

      <footer className="border-t border-border mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Building2 className="h-4 w-4" />
          <span>Briitely OS — Business Dashboard</span>
        </div>
      </footer>
    </div>
  );
}
