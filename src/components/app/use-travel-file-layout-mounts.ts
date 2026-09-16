"use client";

import { useEffect } from "react";

export function useTravelFileLayoutMounts(travelFileId: string) {
  useEffect(() => {
    const main = document.querySelector("main");

    if (main) {
      const direct = [...main.children] as HTMLElement[];
      const find = (...needles: string[]) =>
        direct.find((element) => needles.every((needle) => element.textContent?.includes(needle)));
      const ordered = [
        find("Current action", "Due / Waiting"),
        find("Team", "Assignment", "Ownership"),
        find("Travel Party", "Who is travelling on this trip"),
        find("Trip details", "Trip information"),
        find("Booking & planning", "Booking information"),
        find("Pre-trip", "Insurance", "Insurance & pre-trip"),
        find("Notes"),
        find("Payments", "Payment schedule and current status"),
        find("Consultation", "Retainer details"),
        find("Inquiry", "Inquiry details"),
        find("History", "Consultations"),
        find("History", "Actions"),
        find("History", "Activity"),
      ].filter((element): element is HTMLElement => Boolean(element));
      for (const element of ordered) main.appendChild(element);
    }
  }, [travelFileId]);
}
