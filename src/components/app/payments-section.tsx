"use client";

import { useState } from "react";
import { Button } from "@/components/core/ui/button";
import { PaymentEditorModal } from "@/components/app/payment-editor-modal";
import { PaymentsTable } from "@/components/app/payments-table";
import { PaymentGroupManagerModal } from "@/components/app/payment-group-manager-modal";

export function PaymentsSection({ travelFileId }: { travelFileId: string }) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  return (
    <div className="rounded-xl border bg-[#fffefa] p-5 shadow-sm">
      <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
            Financial
          </div>
          <div className="mt-1 font-serif text-xl leading-tight">Payments</div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Payment schedule and current status.
          </p>
          <div className="mt-3 flex w-full flex-col items-start gap-2">
            <Button
              variant="outline"
              size="sm"
              className="justify-start"
              onClick={() => setEditorOpen(true)}
            >
              + Add Payment
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="justify-start"
              onClick={() => setGroupsOpen(true)}
            >
              Create / Edit Booking Groups
            </Button>
          </div>
        </div>
        <div>
          <PaymentsTable travelFileId={travelFileId} refreshToken={refreshToken} />
        </div>
      </div>

      <PaymentGroupManagerModal
        travelFileId={travelFileId}
        isOpen={groupsOpen}
        onClose={() => setGroupsOpen(false)}
        onSaved={() => setRefreshToken((value) => value + 1)}
      />

      <PaymentEditorModal
        travelFileId={travelFileId}
        payment={null}
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSaved={() => setRefreshToken((value) => value + 1)}
      />
    </div>
  );
}
