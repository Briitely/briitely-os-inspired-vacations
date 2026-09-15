"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { RefreshCw, Settings2 } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { WorkflowOverrideModal } from "@/components/app/workflow-override-modal";
import { CurrentActionControls } from "@/components/app/current-action-controls";
import { SendTmfModal } from "@/components/app/send-tmf-modal";

interface WorkflowOverrideButtonProps {
  travelFileId: string;
  currentStage: string;
  currentActionCode: string | null;
  currentActionStatus: string | null;
  currentResponsibleType: string | null;
  currentResponsibleName: string | null;
}
type ResendDetails={clientName:string;email:string;phone:string;destination:string|null;assignedAdvisorName:string|null;tmfAmount:number|null;revisionsIncluded:number|null};

export function WorkflowOverrideButton({travelFileId,currentStage,currentActionCode,currentActionStatus,currentResponsibleType,currentResponsibleName}:WorkflowOverrideButtonProps) {
  const [open,setOpen]=useState(false);const[openKey,setOpenKey]=useState(0);const[dueAt,setDueAt]=useState<string|null>(null);const[notes,setNotes]=useState<string|null>(null);const[resend,setResend]=useState<ResendDetails|null>(null);const[resendOpen,setResendOpen]=useState(false);const[actionMount,setActionMount]=useState<HTMLElement|null>(null);
  useEffect(()=>{let active=true;fetch(`/api/travel-files/${encodeURIComponent(travelFileId)}/current-action`).then(r=>r.ok?r.json():null).then(d=>{if(active&&d?.action){setDueAt(d.action.due_at??null);setNotes(d.action.notes??null);setResend(d.resendForms??null)}}).catch(()=>{});return()=>{active=false}},[travelFileId,currentActionCode]);
  useEffect(()=>{if(currentActionCode!=="await_tmf_and_booking_form"||currentActionStatus!=="active")return;const root=document.querySelector(".workflow-action-controls")?.closest(".rounded-xl.border");const row=root?.querySelector(".mt-4.flex.flex-col.justify-between") as HTMLElement|null;if(!row)return;const mount=document.createElement("div");mount.className="shrink-0";row.appendChild(mount);setActionMount(mount);return()=>{mount.remove();setActionMount(null)}},[currentActionCode,currentActionStatus]);
  const canResend=currentActionCode==="await_tmf_and_booking_form"&&currentActionStatus==="active"&&resend;
  return <>
    <div className="workflow-action-controls w-full">
      <Button variant="outline" size="sm" onClick={()=>{setOpenKey(k=>k+1);setOpen(true)}} className="h-7 justify-start gap-1 text-xs"><Settings2 className="h-3.5 w-3.5"/>Override</Button>
      {currentActionCode&&<CurrentActionControls travelFileId={travelFileId} dueAt={dueAt} notes={notes}/>} 
    </div>
    {canResend&&actionMount&&createPortal(<Button onClick={()=>setResendOpen(true)} className="gap-2"><RefreshCw className="h-4 w-4"/>Resend Forms</Button>,actionMount)}
    {canResend&&resendOpen&&<SendTmfModal travelFileId={travelFileId} clientName={resend.clientName} email={resend.email} phone={resend.phone} destination={resend.destination} assignedAdvisorName={resend.assignedAdvisorName} tmfAmount={resend.tmfAmount} revisionsIncluded={resend.revisionsIncluded} agreementDate={new Date().toLocaleDateString("en-CA")} mode="resend" isOpen={resendOpen} onClose={()=>setResendOpen(false)}/>} 
    <WorkflowOverrideModal key={openKey} travelFileId={travelFileId} currentStage={currentStage} currentActionCode={currentActionCode} currentActionStatus={currentActionStatus} currentResponsibleType={currentResponsibleType} currentResponsibleName={currentResponsibleName} isOpen={open} onClose={()=>setOpen(false)}/>
  </>;
}
