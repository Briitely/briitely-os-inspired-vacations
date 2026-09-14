"use client";

import { useEffect } from "react";

function todayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addBadge(title: Element | null) {
  if (!title || title.parentElement?.querySelector("[data-overdue-badge]")) return;
  const badge = document.createElement("span");
  badge.dataset.overdueBadge = "true";
  badge.textContent = "Overdue";
  badge.className = "ml-2 inline-flex rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700";
  title.parentElement?.appendChild(badge);
}

function styleTaskRow(row: HTMLElement) {
  row.classList.add("bg-red-50/70");
  const title = row.querySelector("a.text-primary, p.text-sm.font-medium");
  title?.classList.add("text-red-700");
  addBadge(title);
}

export function OverdueTaskHighlighter() {
  useEffect(() => {
    const apply = () => {
      const today = todayKey();
      const path = window.location.pathname;

      if (path === "/tasks") {
        document.querySelectorAll<HTMLInputElement>('input[type="date"]').forEach((input) => {
          if (!input.value || input.value >= today) return;
          const row = input.closest("div.grid.border-b") as HTMLElement | null;
          if (row) styleTaskRow(row);
        });
      }

      if (path.startsWith("/travel-files/")) {
        document.querySelectorAll<HTMLInputElement>('input[type="date"]').forEach((input) => {
          if (!input.value || input.value >= today) return;
          const card = input.closest("div.rounded-lg.border") as HTMLElement | null;
          if (!card || !card.textContent?.includes("Payments due —")) return;
          card.classList.add("bg-red-50/70", "border-red-200");
          const title = [...card.querySelectorAll("p")].find((el) => el.textContent?.includes("Payments due —")) ?? null;
          title?.classList.add("text-red-700");
          addBadge(title);
        });
      }
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
