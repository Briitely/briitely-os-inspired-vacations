"use client";

import { useState } from "react";
import { CircleSlash2, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { DeleteTravelFileDialog } from "@/components/app/delete-travel-file-dialog";
import { MarkLostDialog } from "@/components/app/mark-lost-dialog";
import { ReopenTravelFileDialog } from "@/components/app/reopen-travel-file-dialog";

interface TravelFileActionsProps {
  travelFileId: string;
  clientName: string;
  destination: string | null;
  tripType: string | null;
  canDelete: boolean;
  canManage: boolean;
  fileStatus: string;
  stage: string;
}

export function TravelFileActions({
  travelFileId,
  clientName,
  destination,
  tripType,
  canDelete,
  canManage,
  fileStatus,
  stage,
}: TravelFileActionsProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);

  return (
    <>
      {canManage && fileStatus === "open" && <Button variant="outline" size="sm" onClick={() => setLostOpen(true)}><CircleSlash2 className="h-4 w-4" />Mark Lost / Not Qualified</Button>}
      {canManage && stage === "lost_not_qualified" && <Button variant="outline" size="sm" onClick={() => setReopenOpen(true)}><RotateCcw className="h-4 w-4" />Reopen Travel File</Button>}
      {canDelete && <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
        <Trash2 className="h-4 w-4" />
        Delete Travel File
      </Button>}
      <MarkLostDialog travelFileId={travelFileId} isOpen={lostOpen} onClose={() => setLostOpen(false)} />
      <ReopenTravelFileDialog travelFileId={travelFileId} isOpen={reopenOpen} onClose={() => setReopenOpen(false)} />
      <DeleteTravelFileDialog
        travelFileId={travelFileId}
        clientName={clientName}
        destination={destination}
        tripType={tripType}
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
      />
    </>
  );
}
