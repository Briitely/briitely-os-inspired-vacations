"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/core/ui/card";
import { Badge } from "@/components/core/ui/badge";
import { Loader2, Plane } from "lucide-react";
import { formatStageLabel, formatStageBadgeVariant } from "@/lib/travel/stage-labels";
import { formatReadableDate } from "@/lib/travel/format";

interface TravelFileSummary {
  id: string;
  destination: string | null;
  stage: string;
  departure_date: string | null;
  file_status: string;
  current_action: { title: string } | null;
}

export function CustomerTravelFiles({ customerId }: { customerId: string }) {
  const [files, setFiles] = useState<TravelFileSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/travel-files/customer/${encodeURIComponent(customerId)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load Travel Files.");
        if (active) {
          setFiles(data.files ?? []);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load Travel Files.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [customerId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Travel Files</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading Travel Files...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Travel Files</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive py-6">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (files.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Travel Files</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-6">No Travel Files for this customer.</p>
        </CardContent>
      </Card>
    );
  }

  const openFiles = files.filter((f) => f.file_status === "open");
  const closedFiles = files.filter((f) => f.file_status === "closed");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Travel Files</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {openFiles.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Open
            </p>
            <div className="divide-y divide-border">
              {openFiles.map((file) => (
                <TravelFileRow key={file.id} file={file} />
              ))}
            </div>
          </div>
        )}
        {closedFiles.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Past / Closed
            </p>
            <div className="divide-y divide-border">
              {closedFiles.map((file) => (
                <TravelFileRow key={file.id} file={file} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TravelFileRow({ file }: { file: TravelFileSummary }) {
  return (
    <Link
      href={`/travel-files/${file.id}`}
      className="flex items-center justify-between gap-3 py-3 hover:bg-muted/30 -mx-2 px-2 rounded transition-colors"
    >
      <div className="flex items-center gap-3 min-w-0">
        <Plane className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {file.destination || "Trip details pending"}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {file.departure_date && <span>Dep {formatReadableDate(file.departure_date)}</span>}
            {file.current_action && (
              <span className="truncate">· {file.current_action.title}</span>
            )}
          </div>
        </div>
      </div>
      <Badge
        variant={formatStageBadgeVariant(file.stage as Parameters<typeof formatStageBadgeVariant>[0])}
        className="shrink-0"
      >
        {formatStageLabel(file.stage as Parameters<typeof formatStageLabel>[0])}
      </Badge>
    </Link>
  );
}
