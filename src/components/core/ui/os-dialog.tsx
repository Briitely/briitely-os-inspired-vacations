"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/core/ui/button";

/**
 * Briitely OS standard pop-up (the Inspired Vacations design): dimmed backdrop,
 * rounded card, small uppercase eyebrow over the title, close button, body,
 * and a footer with Cancel and the main action. Use this for every pop-up;
 * never window.confirm / alert / prompt.
 */
export function OsDialog({ open, onClose, eyebrow, title, children, footer, size = "md", busy = false }: {
  open: boolean;
  onClose: () => void;
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  busy?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);
  if (!open) return null;
  const width = size === "sm" ? "max-w-md" : size === "lg" ? "max-w-2xl" : "max-w-lg";
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-24" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`w-full ${width} rounded-xl bg-background p-6 shadow-2xl`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            {eyebrow ? <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-primary">{eyebrow}</p> : null}
            <h2 className="mt-1 text-xl font-semibold">{title}</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy} aria-label="Close"><X className="h-4 w-4" /></Button>
        </div>
        {children ? <div className="mt-5 space-y-4 text-sm">{children}</div> : null}
        {footer ? <div className="mt-6 flex justify-end gap-3">{footer}</div> : null}
      </div>
    </div>
  );
}

/** "Are you sure?" in the standard pop-up. tone="danger" makes the main button red. */
export function ConfirmDialog({ open, eyebrow = "Please confirm", title, message, confirmLabel, cancelLabel = "Cancel", tone = "default", busy = false, onConfirm, onCancel }: {
  open: boolean;
  eyebrow?: string;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <OsDialog open={open} onClose={onCancel} eyebrow={eyebrow} title={title} size="sm" busy={busy}
      footer={<>
        <Button variant="outline" onClick={onCancel} disabled={busy}>{cancelLabel}</Button>
        <Button variant={tone === "danger" ? "destructive" : "default"} onClick={onConfirm} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{confirmLabel}</Button>
      </>}>
      <div className="text-muted-foreground">{message}</div>
    </OsDialog>
  );
}

type ConfirmRequest = { eyebrow?: string; title: string; message: ReactNode; confirmLabel: string; tone?: "default" | "danger" };
type PendingConfirm = ConfirmRequest & { resolve: (ok: boolean) => void };
let showConfirm: ((request: PendingConfirm) => void) | null = null;

/**
 * The branded replacement for window.confirm: `if (!(await osConfirm({ ... }))) return;`
 * Needs <ConfirmHost /> once in the root layout. Falls back to "no" if it isn't mounted.
 */
export function osConfirm(request: ConfirmRequest): Promise<boolean> {
  return new Promise((resolve) => {
    if (!showConfirm) { resolve(false); return; }
    showConfirm({ ...request, resolve });
  });
}

/** Mount once in the root layout; it shows the pop-ups requested by osConfirm. */
export function ConfirmHost() {
  const [request, setRequest] = useState<PendingConfirm | null>(null);
  useEffect(() => { showConfirm = setRequest; return () => { showConfirm = null; }; }, []);
  const close = (ok: boolean) => { request?.resolve(ok); setRequest(null); };
  return <ConfirmDialog open={Boolean(request)} eyebrow={request?.eyebrow} title={request?.title ?? ""} message={request?.message ?? ""} confirmLabel={request?.confirmLabel ?? "Confirm"} tone={request?.tone} onConfirm={() => close(true)} onCancel={() => close(false)} />;
}
