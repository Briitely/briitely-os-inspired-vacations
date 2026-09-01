"use client";

import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { WorkflowOverrideModal } from "@/components/app/workflow-override-modal";
import { CurrentActionControls } from "@/components/app/current-action-controls";

interface WorkflowOverrideButtonProps {
  travelFileId: string;
  currentStage: string;
  currentActionCode: string | null;
  currentActionStatus: string | null;
  currentResponsibleType: string | null;
  currentResponsibleName: string | null;
}

export function WorkflowOverrideButton({travelFileId,currentStage,currentActionCode,currentActionStatus,currentResponsibleType,currentResponsibleName}:WorkflowOverrideButtonProps) {
  const [open,setOpen]=useState(false);const[openKey,setOpenKey]=useState(0);const[dueAt,setDueAt]=useState<string|null>(null);const[notes,setNotes]=useState<string|null>(null);
  useEffect(()=>{let active=true;fetch(`/api/travel-files/${encodeURIComponent(travelFileId)}/current-action`).then(r=>r.ok?r.json():null).then(d=>{if(active&&d?.action){setDueAt(d.action.due_at??null);setNotes(d.action.notes??null)}}).catch(()=>{});return()=>{active=false}},[travelFileId,currentActionCode]);
  return <>
    <div className="workflow-action-controls w-full">
      <Button variant="outline" size="sm" onClick={()=>{setOpenKey(k=>k+1);setOpen(true)}} className="h-7 justify-start gap-1 text-xs"><Settings2 className="h-3.5 w-3.5"/>Override</Button>
      {currentActionCode&&<CurrentActionControls travelFileId={travelFileId} dueAt={dueAt} notes={notes}/>} 
    </div>
    <WorkflowOverrideModal key={openKey} travelFileId={travelFileId} currentStage={currentStage} currentActionCode={currentActionCode} currentActionStatus={currentActionStatus} currentResponsibleType={currentResponsibleType} currentResponsibleName={currentResponsibleName} isOpen={open} onClose={()=>setOpen(false)}/>
  </>;
}
