"use client";

import { useEffect, useState } from "react";

export type TravelFileLayoutMounts = {
  paymentMount: HTMLElement | null;
};

export function useTravelFileLayoutMounts(
  travelFileId: string,
): TravelFileLayoutMounts {
  const [paymentMount, setPaymentMount] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let payment: HTMLElement | null = null;
    let oldPaymentContent: HTMLElement | null = null;

    const main = document.querySelector("main");
    const panels = [...document.querySelectorAll("main > div")] as HTMLElement[];

    const paymentsPanel = panels.find(
      (element) =>
        element.textContent?.includes("Payments") &&
        element.textContent?.includes("Payment schedule and current status"),
    );
    if (paymentsPanel) {
      const content = paymentsPanel.querySelector(
        ".md\\:grid-cols-\\[220px_minmax\\(0\\,1fr\\)\\] > div:nth-child(2)",
      ) as HTMLElement | null;
      if (content) {
        oldPaymentContent = content.firstElementChild as HTMLElement | null;
        if (oldPaymentContent) oldPaymentContent.style.display = "none";
        payment = document.createElement("div");
        content.appendChild(payment);
        setPaymentMount(payment);
      }
    }

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

    return () => {
      payment?.remove();
      if (oldPaymentContent) oldPaymentContent.style.display = "";
    };
  }, [travelFileId]);

  return { paymentMount };
}
