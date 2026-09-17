"use client";

import { useState } from "react";
import { Button } from "@/components/core/ui/button";
import { PaymentEditorModal } from "@/components/app/payment-editor-modal";
import { PaymentsTable } from "@/components/app/payments-table";

export function PaymentsSection({ travelFileId }: { travelFileId: string }) {
  const [editorOpen, setEditorOpen] = useState(false);
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
          <div className="mt-3 w-full">
            <Button
              variant="outline"
              size="sm"
              className="justify-start"
              onClick={() => setEditorOpen(true)}
            >
              + Add Payment
            </Button>
          </div>
        </div>
        <div>
          <PaymentsTable travelFileId={travelFileId} refreshToken={refreshToken} />
        </div>
      </div>

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
