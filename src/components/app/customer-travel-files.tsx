"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/core/ui/card";
import { Badge } from "@/components/core/ui/badge";
import { Button } from "@/components/core/ui/button";
import { Loader2, Plane, Plus, AlertTriangle } from "lucide-react";
import { formatStageLabel, formatStageBadgeVariant } from "@/lib/travel/stage-labels";
import { formatDateOnly } from "@/lib/travel/format";
import { CreateTravelFileModal } from "@/components/app/create-travel-file-modal";
import type { BriitelyCustomer } from "@/lib/briitely/types";

interface TravelFileSummary {
  id: string;
  destination: string | null;
  stage: string;
  departure_date: string | null;
  file_status: string;
  current_action: { title: string } | null;
}

interface AdvisorOption {
  id: string;
  full_name: string;
}

interface CustomerTravelFilesProps {
  customer: BriitelyCustomer;
}

export function CustomerTravelFiles({ customer }: CustomerTravelFilesProps) {
  const router = useRouter();
  const [files, setFiles] = useState<TravelFileSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [advisors, setAdvisors] = useState<AdvisorOption[]>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/travel-files/customer/${encodeURIComponent(customer.id)}`)
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
  }, [customer.id]);

  useEffect(() => {
    fetch("/api/travel-files/advisors")
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) setAdvisors(data.advisors ?? []);
      })
      .catch(() => {});
  }, []);

  const openFiles = files.filter((f) => f.file_status === "open");
  const closedFiles = files.filter((f) => f.file_status === "closed");

  function handleOpenCreate() {
    if (openFiles.length > 0) {
      setShowDuplicateWarning(true);
    } else {
      setModalOpen(true);
    }
  }

  function handleCreated(travelFileId: string) {
    // Refresh the file list and navigate to the new travel file
    fetch(`/api/travel-files/customer/${encodeURIComponent(customer.id)}`)
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) setFiles(data.files ?? []);
      })
      .finally(() => {
        router.push(`/travel-files/${travelFileId}`);
        router.refresh();
      });
  }

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

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Travel Files</CardTitle>
            <Button size="sm" onClick={handleOpenCreate}>
              <Plus className="h-4 w-4" />
              Create Travel File
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {files.length === 0 && (
            <p className="text-sm text-muted-foreground py-6">No Travel Files for this customer.</p>
          )}

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

      {showDuplicateWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation">
          <div className="w-full max-w-lg rounded-xl border bg-background shadow-xl" role="dialog" aria-modal="true" aria-labelledby="duplicate-warning-title">
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent">
                  <AlertTriangle className="h-5 w-5 text-foreground" />
                </div>
                <div className="space-y-1">
                  <h2 id="duplicate-warning-title" className="text-lg font-semibold">This customer already has an open Travel File</h2>
                  <p className="text-sm text-muted-foreground">
                    You can still create a new one if this is a separate trip.
                  </p>
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
                {openFiles.map((file) => (
                  <div key={file.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {file.destination || "Trip details pending"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatStageLabel(file.stage as Parameters<typeof formatStageLabel>[0])}
                        {file.departure_date && ` · Dep ${formatDateOnly(file.departure_date)}`}
                      </p>
                    </div>
                    <Link href={`/travel-files/${file.id}`} className="text-sm text-primary hover:underline shrink-0">
                      Open
                    </Link>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 border-t pt-4">
                <Button variant="outline" onClick={() => setShowDuplicateWarning(false)}>Cancel</Button>
                <Button onClick={() => { setShowDuplicateWarning(false); setModalOpen(true); }}>
                  Continue Creating New File
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <CreateTravelFileModal
        customer={customer}
        advisors={advisors}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onCreated={handleCreated}
      />
    </>
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
            {file.departure_date && <span>Dep {formatDateOnly(file.departure_date)}</span>}
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
