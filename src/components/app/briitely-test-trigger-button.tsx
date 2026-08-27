"use client";

import { useState } from "react";
import { Zap, Loader2 } from "lucide-react";
import { Button } from "@/components/core/ui/button";

export function BriitelyTestTriggerButton({ travelFileId }: { travelFileId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<"idle" | "success" | "error">("idle");

  async function handleClick() {
    setLoading(true);
    setResult("idle");
    try {
      const res = await fetch(`/api/travel-files/${travelFileId}/trigger-briitely-test`, {
        method: "POST",
      });
      if (res.ok) {
        setResult("success");
      } else {
        setResult("error");
      }
    } catch {
      setResult("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Zap className="h-4 w-4" />
        )}
        Trigger Briitely Test Automation
      </Button>
      {result === "success" && (
        <span className="text-sm text-green-600 font-medium">
          Briitely test trigger sent.
        </span>
      )}
      {result === "error" && (
        <span className="text-sm text-destructive font-medium">
          The Briitely test trigger could not be sent.
        </span>
      )}
    </div>
  );
}
