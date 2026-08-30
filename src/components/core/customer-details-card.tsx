"use client";

import { useState } from "react";
import { ArrowLeft, Building2, FileText, Mail, MapPin, Pencil, Phone, UserRound, CreditCard } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/core/ui/card";
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

const details = [
  { key: "companyName", label: "Business Name", icon: Building2 },
  { key: "name", label: "Contact Name", icon: UserRound },
  { key: "email", label: "Email", icon: Mail },
  { key: "phone", label: "Phone", icon: Phone },
  { key: "address1", label: "Address", icon: MapPin },
  { key: "city", label: "City", icon: MapPin },
  { key: "state", label: "Province", icon: MapPin },
  { key: "postalCode", label: "Postal Code", icon: MapPin },
] as const;

export function CustomerDetailsCard({ customer, onCustomerUpdated, onChangeCustomer, onBackToSearch, onCreateInvoice, onReceivePayment, showChangeCustomer = false }: CustomerDetailsCardProps) {
  const [editing, setEditing] = useState(false);
  const hasSecondaryActions = Boolean(onCreateInvoice || onReceivePayment || (showChangeCustomer && onChangeCustomer));

  return (
    <>
      <Card className="border-primary/20 shadow-md">
        <CardHeader className="space-y-3">
          {onBackToSearch && <Button variant="ghost" className="-ml-3 w-fit" onClick={onBackToSearch}><ArrowLeft className="h-4 w-4" />Back to Search</Button>}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-primary">Customer selected</p>
              <CardTitle className="mt-1 text-2xl">{customer.companyName || customer.name || "Customer"}</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" />Update Customer</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {details.map(({ key, label, icon: Icon }) => {
              const rawValue = customer[key];
              const value = key === "state" && rawValue ? getProvinceName(rawValue) : key === "phone" ? formatPhoneNumber(rawValue) : rawValue;
              return <div key={key} className="flex gap-3"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="break-words font-medium">{value || "Not provided"}</p></div></div>;
            })}
          </div>
          {hasSecondaryActions && <div className="flex flex-wrap gap-3 border-t border-border pt-5">
            {onCreateInvoice && <Button variant="secondary" onClick={onCreateInvoice}><FileText className="h-4 w-4" />Create Invoice</Button>}
            {onReceivePayment && <Button variant="secondary" onClick={onReceivePayment}><CreditCard className="h-4 w-4" />Receive Payment</Button>}
            {showChangeCustomer && onChangeCustomer && <Button variant="outline" onClick={onChangeCustomer}>Change Customer</Button>}
          </div>}
        </CardContent>
      </Card>
      <CustomerEditModal key={`${customer.id}-${editing}`} customer={customer} open={editing} onOpenChange={setEditing} onUpdated={onCustomerUpdated} />
    </>
  );
}
