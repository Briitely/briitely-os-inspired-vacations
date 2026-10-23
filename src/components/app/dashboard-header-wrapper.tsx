import { getBusinessSettings } from "@/lib/briitely/client-settings";
import { DashboardHeader } from "@/components/app/dashboard-header";
import { visibleNavigation } from "@/lib/navigation";

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
      // Filtered here, on the server, so the browser only gets what this person may see.
      navigation={visibleNavigation(role)}
    />
  );
}
