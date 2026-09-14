"use client";

import {useState} from "react";
import {useRouter} from "next/navigation";
import {WalletCards} from "lucide-react";
import {Button} from "@/components/core/ui/button";
import {DepositConfirmationModal} from "@/components/app/deposit-confirmation-modal";

export function ProcessDepositButton({travelFileId}:{travelFileId:string}){
 const router=useRouter();const[open,setOpen]=useState(false);
 return <><Button size="sm" onClick={()=>setOpen(true)}><WalletCards className="h-4 w-4"/>Process Deposit</Button><DepositConfirmationModal travelFileId={travelFileId} isOpen={open} onClose={()=>setOpen(false)} onConfirmed={()=>router.refresh()}/></>;
}
