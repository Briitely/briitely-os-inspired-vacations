"use client";

import { useState, useEffect } from "react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/core/ui/card";

interface FieldDefinition {
  fieldId: string;
  fieldKey: string | null;
  dataType: string | null;
  options: string[];
}

export function TravelInterestsTestPanel({ travelFileId }: { travelFileId: string }) {
  const [fieldDef, setFieldDef] = useState<FieldDefinition | null>(null);
  const [loadingDef, setLoadingDef] = useState(true);
  const [defError, setDefError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<"idle" | "success" | "error">("idle");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/travel-files/${travelFileId}/sync-travel-interests`, {
          method: "GET",
        });
        if (!res.ok) {
          if (!cancelled) setDefError("Could not load Travel Interests field definition from Briitely.");
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setFieldDef({
            fieldId: data.fieldId,
            fieldKey: data.fieldKey,
            dataType: data.dataType,
            options: data.options ?? [],
          });
        }
      } catch {
        if (!cancelled) setDefError("Could not load Travel Interests field definition from Briitely.");
      } finally {
        if (!cancelled) setLoadingDef(false);
      }
    })();
    return () => { cancelled = true; };
  }, [travelFileId]);

  function toggleOption(option: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(option)) {
        next.delete(option);
      } else {
        next.add(option);
      }
      return next;
    });
  }

  async function handleSync() {
    setSyncing(true);
    setResult("idle");
    try {
      const res = await fetch(`/api/travel-files/${travelFileId}/sync-travel-interests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedOptions: [...selected] }),
      });
      if (res.ok) {
        setResult("success");
      } else {
        setResult("error");
      }
    } catch {
      setResult("error");
    } finally {
      setSyncing(false);
    }
  }

  if (loadingDef) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Test Travel Interests Sync</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading Travel Interests field definition from Briitely...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (defError || !fieldDef) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Test Travel Interests Sync</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {defError ?? "Travel Interests field not found."}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test Travel Interests Sync</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-xs text-muted-foreground space-y-0.5">
          <p>Field ID: <span className="font-mono">{fieldDef.fieldId}</span></p>
          <p>Field Type: <span className="font-mono">{fieldDef.dataType ?? "unknown"}</span></p>
          {fieldDef.fieldKey && (
            <p>Field Key: <span className="font-mono">{fieldDef.fieldKey}</span></p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Select Travel Interests:</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {fieldDef.options.map((option) => (
              <label
                key={option}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-2 cursor-pointer hover:bg-accent transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selected.has(option)}
                  onChange={() => toggleOption(option)}
                  className="h-4 w-4 rounded border-border"
                />
                <span className="text-sm text-foreground">{option}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleSync}
            disabled={syncing || selected.size === 0}
            size="sm"
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Sync Travel Interests to Briitely
          </Button>
          <span className="text-xs text-muted-foreground">
            {selected.size} selected
          </span>
          {result === "success" && (
            <span className="text-sm text-green-600 font-medium">
              Travel Interests synced to Briitely.
            </span>
          )}
          {result === "error" && (
            <span className="text-sm text-destructive font-medium">
              The Travel Interests sync could not be completed.
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
