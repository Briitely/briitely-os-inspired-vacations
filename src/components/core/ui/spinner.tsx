import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** The standard "the system is thinking" wheel, with an optional label. */
export function Spinner({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn("flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted-foreground", className)}>
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
