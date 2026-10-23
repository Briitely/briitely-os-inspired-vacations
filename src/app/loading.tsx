import { Spinner } from "@/components/core/ui/spinner";

// Shown the moment someone moves to a page that is still loading. The empty
// strip holds the header's place so the screen doesn't jump.
export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="h-[81px] border-b border-border bg-card" />
      <main className="workspace-shell"><Spinner /></main>
    </div>
  );
}
