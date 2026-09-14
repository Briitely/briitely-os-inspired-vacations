"use client";

import { useEffect } from "react";

export function OverdueTaskHighlighter() {
  useEffect(() => {
    const apply = () => {
      const rows = document.querySelectorAll("main .rounded-xl.border.bg-card > div > div.border-b");
      rows.forEach((row) => {
        const dueWrapper = row.querySelector(".text-destructive");
        if (!dueWrapper) return;
        row.classList.add("bg-red-50/70");
        const title = row.querySelector("a.text-primary, p.text-sm.font-medium");
        if (title) title.classList.add("text-red-700");
        if (!row.querySelector("[data-overdue-badge]")) {
          const badge = document.createElement("span");
          badge.dataset.overdueBadge = "true";
          badge.textContent = "Overdue";
          badge.className = "ml-2 inline-flex rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700";
          title?.parentElement?.appendChild(badge);
        }
      });
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
