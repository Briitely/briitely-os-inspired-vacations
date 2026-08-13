import { getBusinessSettings } from "@/lib/briitely/client-settings";
import { DashboardHeader } from "@/components/app/dashboard-header";

interface DashboardHeaderWrapperProps {
  fullName: string;
  email: string;
  role: "super_admin" | "admin" | "staff";
}

export async function DashboardHeaderWrapper({ fullName, email, role }: DashboardHeaderWrapperProps) {
  const business = await getBusinessSettings();
  return (
    <DashboardHeader
      fullName={fullName}
      email={email}
      role={role}
      logoUrl={business.logoUrl}
      businessName={business.businessName}
    />
  );
}
