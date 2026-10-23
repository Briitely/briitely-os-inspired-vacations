"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Building2 } from "lucide-react";
import { AppNav } from "@/components/core/app-nav";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import type { VisibleNavItem } from "@/lib/navigation-active";

interface DashboardHeaderProps {
  fullName: string;
  email: string;
  role: "super_admin" | "admin" | "staff";
  logoUrl?: string;
  businessName?: string;
  navigation: VisibleNavItem[];
}

/** The sticky header on every signed-in page: logo (home), the menu, and the user block. */
export function DashboardHeader({ fullName, email, role, logoUrl, businessName, navigation }: DashboardHeaderProps) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="os-header">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between gap-4">
          <Link href="/dashboard" className="flex min-w-0 shrink-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" title="Go to Dashboard">
            {logoUrl ? (
              <img src={logoUrl} alt={businessName || "Business"} className="h-11 w-auto max-w-[140px] shrink-0 rounded-lg object-contain xl:max-w-[180px]" />
            ) : (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Building2 className="h-6 w-6" /></div>
            )}
            <div className="min-w-0 max-w-[11rem] sm:max-w-[16rem] lg:max-w-[9rem] xl:max-w-[14rem]">
              <p className="truncate text-lg font-bold leading-tight text-foreground">{businessName || "Business Dashboard"}</p>
              <p className="truncate text-xs text-muted-foreground">Business Dashboard</p>
            </div>
          </Link>
          <AppNav items={navigation} user={{ name: fullName, email, roleLabel: ROLE_LABELS[role] }} onSignOut={handleLogout} />
        </div>
      </div>
    </header>
  );
}
