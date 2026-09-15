"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { SendTmfModal } from "@/components/app/send-tmf-modal";

type Props={
  travelFileId:string;
  clientName:string;
  email:string;
  phone:string;
  destination:string|null;
  assignedAdvisorName:string|null;
  tmfAmount:number|null;
  revisionsIncluded:number|null;
};

export function CurrentActionResendForms(props:Props){
  const[open,setOpen]=useState(false);
  return <>
    <Button onClick={()=>setOpen(true)} className="gap-2"><RefreshCw className="h-4 w-4"/>Resend Forms</Button>
    {open&&<SendTmfModal travelFileId={props.travelFileId} clientName={props.clientName} email={props.email} phone={props.phone} destination={props.destination} assignedAdvisorName={props.assignedAdvisorName} tmfAmount={props.tmfAmount} revisionsIncluded={props.revisionsIncluded} agreementDate={new Date().toLocaleDateString("en-CA")} mode="resend" isOpen={open} onClose={()=>setOpen(false)}/>} 
  </>;
}
