"use client";

import { useState } from "react";
import { RefreshCw, Send } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { SendTmfModal } from "@/components/app/send-tmf-modal";

interface SendTmfButtonProps {travelFileId:string;clientName:string;email:string;phone:string;destination:string|null;assignedAdvisorName:string|null;agreementType:string|null;tmfAmount:number|null;revisionsIncluded:number|null;agreementDate:string;mode?:"initial"|"resend"}
export function SendTmfButton({mode="initial",...props}:SendTmfButtonProps){const[open,setOpen]=useState(false);const[openKey,setOpenKey]=useState(0);const resend=mode==="resend";return <><Button onClick={()=>{setOpenKey(k=>k+1);setOpen(true)}} className="gap-2" variant={resend?"outline":"default"}>{resend?<RefreshCw className="h-4 w-4"/>:<Send className="h-4 w-4"/>}{resend?"Resend Booking Emails":"Send Retainer Agreement"}</Button><SendTmfModal key={openKey}{...props} mode={mode} isOpen={open} onClose={()=>setOpen(false)}/></>}
