import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/core/ui/card";

/**
 * One part of a new-record form (custom order, subscription, event order):
 * eyebrow, heading and a short description on the left, the fields on the right.
 * Every new-record form is a stack of these cards, starting with Customer.
 */
export function FormSectionCard({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return (
    <Card>
      <CardContent className="grid gap-8 p-6 sm:p-7 lg:grid-cols-[210px_minmax(0,1fr)]">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="mt-1 font-display text-2xl font-medium">{title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
        <div className="lg:border-l lg:border-border lg:pl-8">{children}</div>
      </CardContent>
    </Card>
  );
}
