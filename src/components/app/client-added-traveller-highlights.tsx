"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

type HighlightTraveller = { id: string; name: string };

export function ClientAddedTravellerHighlights() {
  const pathname = usePathname();

  useEffect(() => {
    const match = pathname.match(/^\/travel-files\/([^/]+)$/);
    if (!match) return;
    const travelFileId = match[1];
    let cancelled = false;
    let observer: MutationObserver | null = null;

    const applyHighlights = (travellers: HighlightTraveller[]) => {
      const heading = Array.from(document.querySelectorAll("h1,h2,h3,div")).find(el => el.textContent?.trim() === "Travel Party");
      const card = heading?.closest("[class*='rounded'], [class*='border']") ?? heading?.parentElement?.parentElement?.parentElement;
      if (!card) return false;

      const rows = Array.from(card.querySelectorAll("div.flex.flex-col.gap-3.p-4"));
      for (const row of rows) {
        const nameLine = row.querySelector("div.flex.flex-wrap.items-center.gap-2");
        if (!nameLine) continue;
        const traveller = travellers.find(item => Array.from(nameLine.children).some(child => child.textContent?.trim() === item.name));
        if (!traveller) continue;

        row.classList.add("bg-secondary/25");
        row.setAttribute("data-client-added-traveller", "true");
        if (!nameLine.querySelector("[data-client-added-label]")) {
          const added = document.createElement("span");
          added.textContent = "Added";
          added.setAttribute("data-client-added-label", "true");
          added.className = "text-xs font-bold text-foreground/70";
          nameLine.appendChild(added);
        }
      }
      return true;
    };

    void (async () => {
      try {
        const response = await fetch(`/api/travel-files/${encodeURIComponent(travelFileId)}/travellers/client-added-review`);
        if (!response.ok || cancelled) return;
        const data = await response.json() as { travellers?: HighlightTraveller[] };
        const travellers = data.travellers ?? [];
        if (!travellers.length) return;
        if (applyHighlights(travellers)) return;

        observer = new MutationObserver(() => {
          if (applyHighlights(travellers)) observer?.disconnect();
        });
        observer.observe(document.body, { childList: true, subtree: true });
      } catch {
        // Highlighting is a visual review aid and should never interrupt the Travel File.
      }
    })();

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [pathname]);

  return null;
}
