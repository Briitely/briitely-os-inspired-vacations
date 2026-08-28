"use client";

import { useState } from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { WorkflowOverrideModal } from "@/components/app/workflow-override-modal";

interface WorkflowOverrideButtonProps {
  travelFileId: string;
  currentStage: string;
  currentActionCode: string | null;
  currentActionStatus: string | null;
  currentResponsibleType: string | null;
  currentResponsibleName: string | null;
}

export function WorkflowOverrideButton({
  travelFileId,
  currentStage,
  currentActionCode,
  currentActionStatus,
  currentResponsibleType,
  currentResponsibleName,
}: WorkflowOverrideButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-7 gap-1 text-xs"
      >
        <Settings2 className="h-3.5 w-3.5" />
        Override
      </Button>
      <WorkflowOverrideModal
        travelFileId={travelFileId}
        currentStage={currentStage}
        currentActionCode={currentActionCode}
        currentActionStatus={currentActionStatus}
        currentResponsibleType={currentResponsibleType}
        currentResponsibleName={currentResponsibleName}
        isOpen={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
