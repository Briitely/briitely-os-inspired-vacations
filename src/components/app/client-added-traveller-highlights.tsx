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
    let currentTravellers: HighlightTraveller[] = [];

    const clearHighlights = () => {
      const rows = Array.from(document.querySelectorAll("[data-client-added-traveller='true']"));
      for (const row of rows) {
        row.classList.remove("bg-secondary/25");
        row.removeAttribute("data-client-added-traveller");
        row.querySelector("[data-client-added-label]")?.remove();
      }
    };

    const applyHighlights = (travellers: HighlightTraveller[]) => {
      const names = new Set(travellers.map(item => item.name.trim()).filter(Boolean));
      let matched = 0;

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

    const tryApply = () => {
      if (cancelled) return;
      applyHighlights(currentTravellers);
    };

    const refreshHighlights = async () => {
      try {
        const response = await fetch(`/api/travel-files/${encodeURIComponent(travelFileId)}/travellers/client-added-review`, { cache: "no-store" });
        if (!response.ok || cancelled) return;
        const data = await response.json() as { travellers?: HighlightTraveller[] };
        currentTravellers = data.travellers ?? [];
        clearHighlights();
        tryApply();
      } catch (error) {
        console.error("CLIENT_ADDED_TRAVELLER_HIGHLIGHT_FAILED", error);
      }
    };

    const handleReviewChanged = () => {
      void refreshHighlights();
    };

    void refreshHighlights();

    observer = new MutationObserver(() => {
      tryApply();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Keep a short-lived retry in place for initial page hydration. Unlike the old
    // implementation, the observer stays active after the first match so a Travel
    // Party re-render can restore the remaining individual highlights immediately.
    retryTimer = setInterval(tryApply, 500);
    window.addEventListener("client-added-traveller-review-changed", handleReviewChanged);

    return () => {
      cancelled = true;
      observer?.disconnect();
      if (retryTimer) clearInterval(retryTimer);
      window.removeEventListener("client-added-traveller-review-changed", handleReviewChanged);
    };
  }, [pathname]);

  return null;
}
