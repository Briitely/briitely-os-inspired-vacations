"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/core/ui/card";
import { Clock, ChevronRight } from "lucide-react";
import type { ActivityEvent } from "@/lib/activity/types";
import { formatActivityEvent } from "@/lib/activity/format";

interface RecentWorkProps {
  events: ActivityEvent[];
}

export function RecentWork({ events }: RecentWorkProps) {
  const formatted = events.slice(0, 5).map((event) => ({
    id: event.id,
    ...formatActivityEvent(event),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          Recent Work
        </CardTitle>
      </CardHeader>
      <CardContent>
        {formatted.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-base text-muted-foreground">
              No recent work yet.
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {formatted.map((item) => {
              const href = item.link
                ? item.link.type === "invoice"
                  ? `/invoices/${encodeURIComponent(item.link.id)}`
                  : `/customers/${encodeURIComponent(item.link.id)}`
                : null;

              const content = (
                <div className="flex items-start justify-between gap-3 py-3 border-b border-border last:border-0 group-hover:border-primary/30 transition-colors">
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-medium text-foreground truncate">
                      {item.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.subtitle}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              );

              if (href) {
                return (
                  <li key={item.id}>
                    <Link href={href} className="block group rounded-md transition-colors hover:bg-muted/50 -mx-2 px-2">
                      {content}
                    </Link>
                  </li>
                );
              }

              return (
                <li key={item.id} className="group -mx-2 px-2">
                  {content}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
