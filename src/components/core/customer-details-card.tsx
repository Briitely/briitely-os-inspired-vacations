"use client";

import { useState } from "react";
import { ArrowLeft, FileText, Pencil, CreditCard } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { CustomerEditModal } from "@/components/core/customer-edit-modal";
import { getProvinceName } from "@/lib/briitely/provinces";
import { formatPhoneNumber } from "@/lib/format/phone";
import type { BriitelyCustomer } from "@/lib/briitely/types";

interface CustomerDetailsCardProps {
  customer: BriitelyCustomer;
  onCustomerUpdated: (customer: BriitelyCustomer) => void;
  onChangeCustomer?: () => void;
  onBackToSearch?: () => void;
  onCreateInvoice?: () => void;
  onReceivePayment?: () => void;
  showChangeCustomer?: boolean;
}

function Item({label,value}:{label:string;value:string|null|undefined}){return <div><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium break-words">{value||"Not provided"}</p></div>}

export function CustomerDetailsCard({ customer, onCustomerUpdated, onChangeCustomer, onBackToSearch, onCreateInvoice, onReceivePayment, showChangeCustomer = false }: CustomerDetailsCardProps) {
  const [editing, setEditing] = useState(false);
  const hasSecondaryActions = Boolean(onCreateInvoice || onReceivePayment || (showChangeCustomer && onChangeCustomer));
  return <>
    <div className="rounded-xl border bg-[#fffefa] p-5 shadow-sm">
      <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
        <div className="flex flex-col items-start">
          {onBackToSearch && <Button variant="ghost" className="-ml-3 mb-2 w-fit" onClick={onBackToSearch}><ArrowLeft className="h-4 w-4"/>Back to Search</Button>}
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">Client</p>
          <h2 className="mt-1 font-serif text-xl leading-tight">Contact details</h2>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Core contact and mailing information synced with Briitely.</p>
          <div className="mt-3 flex w-full flex-col gap-2">
            <Button variant="outline" size="sm" onClick={()=>setEditing(true)} className="justify-start"><Pencil className="h-4 w-4"/>Edit Contact Details</Button>
            {onCreateInvoice&&<Button variant="outline" size="sm" onClick={onCreateInvoice} className="justify-start"><FileText className="h-4 w-4"/>Create Invoice</Button>}
            {onReceivePayment&&<Button variant="outline" size="sm" onClick={onReceivePayment} className="justify-start"><CreditCard className="h-4 w-4"/>Receive Payment</Button>}
            {showChangeCustomer&&onChangeCustomer&&<Button variant="outline" size="sm" onClick={onChangeCustomer} className="justify-start">Change Customer</Button>}
          </div>
        </div>
        <div>
          <h3 className="mb-3 border-b pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact & address</h3>
          <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            <Item label="Contact name" value={customer.name}/><Item label="Business name" value={customer.companyName}/><Item label="Email" value={customer.email}/><Item label="Phone" value={formatPhoneNumber(customer.phone)}/>
            <Item label="Address" value={customer.address1}/><Item label="City" value={customer.city}/><Item label="Province" value={customer.state?getProvinceName(customer.state):null}/><Item label="Postal code" value={customer.postalCode}/>
          </div>
        </div>
      </div>
    </div>
    <CustomerEditModal key={`${customer.id}-${editing}`} customer={customer} open={editing} onOpenChange={setEditing} onUpdated={onCustomerUpdated}/>
  </>;
}
