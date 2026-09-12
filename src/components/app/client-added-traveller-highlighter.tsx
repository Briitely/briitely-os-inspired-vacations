"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function ClientAddedTravellerHighlighter() {
  const pathname = usePathname();

  useEffect(() => {
    const match = pathname.match(/\/travel-files\/([^/]+)/);
    const travelFileId = match?.[1];
    if (!travelFileId) return;

    let cancelled = false;
    let observer: MutationObserver | null = null;

    async function applyHighlights() {
      try {
        const response = await fetch(`/api/travel-files/${encodeURIComponent(travelFileId)}/travellers/client-added-review`, { cache: "no-store" });
        if (!response.ok || cancelled) return;
        const data = await response.json() as { travellers?: Array<{ id: string; name: string }> };
        const names = new Set((data.travellers ?? []).map(item => item.name).filter(Boolean));
        if (!names.size) return;

        const headings = Array.from(document.querySelectorAll("h1,h2,h3,h4,div"));
        const heading = headings.find(node => node.textContent?.trim() === "Travel Party");
        const card = heading?.closest("[class*='rounded'], [class*='border']") ?? heading?.parentElement?.parentElement;
        if (!card) return;

        const candidates = Array.from(card.querySelectorAll("a,span"));
        for (const node of candidates) {
          const name = node.textContent?.trim();
          if (!name || !names.has(name)) continue;
          const row = node.closest(".p-4");
          if (!row) continue;
          row.classList.add("bg-secondary/25");
          if (!row.querySelector("[data-client-added-badge]")) {
            const badge = document.createElement("span");
            badge.dataset.clientAddedBadge = "true";
            badge.className = "ml-1 text-xs font-bold text-foreground/75";
            badge.textContent = "Added";
            node.insertAdjacentElement("afterend", badge);
          }
        }
      } catch (error) {
        console.error("CLIENT_ADDED_TRAVELLER_HIGHLIGHT_FAILED", error);
      }
    }

    void applyHighlights();
    observer = new MutationObserver(() => void applyHighlights());
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [pathname]);

  return null;
}
