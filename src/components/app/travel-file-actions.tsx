"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { DeleteTravelFileDialog } from "@/components/app/delete-travel-file-dialog";

interface TravelFileActionsProps {
  travelFileId: string;
  clientName: string;
  destination: string | null;
  tripType: string | null;
  canDelete: boolean;
}

export function TravelFileActions({
  travelFileId,
  clientName,
  destination,
  tripType,
  canDelete,
}: TravelFileActionsProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (!canDelete) return null;

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
        <Trash2 className="h-4 w-4" />
        Delete Travel File
      </Button>
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
