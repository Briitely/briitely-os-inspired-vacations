import { getBusinessSettings } from "@/lib/briitely/client-settings";
import { Building2 } from "lucide-react";

interface SharedFooterProps {
  label?: string;
}

export async function SharedFooter({ label }: SharedFooterProps) {
  const business = await getBusinessSettings();
  const text = label
    ? `${business.businessName} — ${label}`
    : `${business.businessName} — Business Dashboard`;

  return (
    <footer className="border-t border-border mt-16">
      <div className="workspace-footer">
        <Building2 className="h-4 w-4" />
        <span>{text}</span>
      </div>
    </footer>
  );
}
