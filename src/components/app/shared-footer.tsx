import { getBusinessSettings } from "@/lib/briitely/client-settings";
import { Building2 } from "lucide-react";

interface SharedFooterProps {
  maxWidth?: "max-w-4xl" | "max-w-6xl";
  label?: string;
}

export async function SharedFooter({ maxWidth = "max-w-6xl", label }: SharedFooterProps) {
  const business = await getBusinessSettings();
  const text = label
    ? `${business.businessName} — ${label}`
    : `${business.businessName} — Business Dashboard`;

  return (
    <footer className="border-t border-border mt-16">
      <div className={`${maxWidth} mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center gap-2 text-sm text-muted-foreground`}>
        <Building2 className="h-4 w-4" />
        <span>{text}</span>
      </div>
    </footer>
  );
}
