"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

type HighlightTraveller = { id: string; name: string };

export function ClientAddedTravellerHighlights() {
  const pathname = usePathname();

  useEffect(() => {
    const match = pathname.match(/^\/travel-files\/([^/]+)\/?$/);
    if (!match) return;
    const travelFileId = match[1];
    let cancelled = false;
    let observer: MutationObserver | null = null;
    let retryTimer: ReturnType<typeof setInterval> | null = null;

    const applyHighlights = (travellers: HighlightTraveller[]) => {
      if (!travellers.length) return false;
      const names = new Set(travellers.map(item => item.name.trim()).filter(Boolean));
      let matched = 0;

      // Match the actual Travel Party row structure directly instead of trying to
      // locate the outer card first. The previous card lookup could stop at an
      // inner bordered element and never reach the traveller rows.
      const rows = Array.from(document.querySelectorAll("div.flex.flex-col.gap-3.p-4"));
      for (const row of rows) {
        const nameLine = row.querySelector("div.flex.flex-wrap.items-center.gap-2");
        if (!nameLine) continue;
        const nameNode = Array.from(nameLine.children).find(child => names.has(child.textContent?.trim() ?? ""));
        if (!nameNode) continue;

        matched++;
        row.classList.add("bg-secondary/25");
        row.setAttribute("data-client-added-traveller", "true");

        if (!nameLine.querySelector("[data-client-added-label]")) {
          const added = document.createElement("span");
          added.textContent = "Added";
          added.setAttribute("data-client-added-label", "true");
          added.className = "text-xs font-bold text-foreground/70";
          nameNode.insertAdjacentElement("afterend", added);
        }
      }

      return matched > 0;
    };

    void (async () => {
      try {
        const response = await fetch(`/api/travel-files/${encodeURIComponent(travelFileId)}/travellers/client-added-review`, { cache: "no-store" });
        if (!response.ok || cancelled) return;
        const data = await response.json() as { travellers?: HighlightTraveller[] };
        const travellers = data.travellers ?? [];
        if (!travellers.length || cancelled) return;

        const tryApply = () => {
          if (cancelled) return;
          if (applyHighlights(travellers)) {
            observer?.disconnect();
            if (retryTimer) clearInterval(retryTimer);
            retryTimer = null;
          }
        };

        tryApply();

        if (!cancelled) {
          observer = new MutationObserver(tryApply);
          observer.observe(document.body, { childList: true, subtree: true });
          retryTimer = setInterval(tryApply, 500);
        }
      } catch (error) {
        console.error("CLIENT_ADDED_TRAVELLER_HIGHLIGHT_FAILED", error);
      }
    })();

    return () => {
      cancelled = true;
      observer?.disconnect();
      if (retryTimer) clearInterval(retryTimer);
    };
  }, [pathname]);

  return null;
}
