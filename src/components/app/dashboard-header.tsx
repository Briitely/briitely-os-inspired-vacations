"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/core/ui/button";
import { Badge } from "@/components/core/ui/badge";
import { LogOut, Building2 } from "lucide-react";

interface DashboardHeaderProps {
  fullName: string;
  email: string;
  role: "super_admin" | "admin" | "staff";
  logoUrl?: string;
  businessName?: string;
}

export function DashboardHeader({ fullName, email, role, logoUrl, businessName }: DashboardHeaderProps) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-border bg-card">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={businessName || "Business"}
                className="h-11 w-auto max-w-[180px] object-contain rounded-lg"
              />
            ) : (
              <div className="flex items-center justify-center h-11 w-11 rounded-lg bg-primary text-primary-foreground">
                <Building2 className="h-6 w-6" />
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold text-foreground leading-tight">
                {businessName || "Business Dashboard"}
              </h1>
              <p className="text-xs text-muted-foreground">Business Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="flex items-center gap-2 justify-end">
                <p className="text-sm font-medium text-foreground">
                  {fullName || email}
                </p>
                {role === "super_admin" && (
                  <Badge className="text-xs">Super Admin</Badge>
                )}
                {role === "admin" && (
                  <Badge className="text-xs">Admin</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground capitalize">
                {role}
              </p>
            </div>
            <Button
              variant="outline"
              size="default"
              onClick={handleLogout}
              className="h-10"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
