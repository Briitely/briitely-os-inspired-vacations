"use client";

import { useEffect, useState } from "react";

export type TravelFileLayoutMounts = {
  planningMount: HTMLElement | null;
  bookingSummaryMount: HTMLElement | null;
  inquirySummaryMount: HTMLElement | null;
  retainerSummaryMount: HTMLElement | null;
  paymentMount: HTMLElement | null;
};

function fieldBlock(panel: HTMLElement, label: string) {
  const target = label.trim().toLowerCase();
  const leaf = [...panel.querySelectorAll("div,span,p")].find(
    (element) =>
      element.children.length === 0 &&
      element.textContent?.trim().toLowerCase() === target,
  ) as HTMLElement | undefined;
  return leaf?.parentElement as HTMLElement | null;
}

function hideInfo(panel: HTMLElement, labels: string[]) {
  for (const label of labels) {
    const block = fieldBlock(panel, label);
    if (block) block.style.display = "none";
  }
}

export function useTravelFileLayoutMounts(
  travelFileId: string,
): TravelFileLayoutMounts {
  const [planningMount, setPlanningMount] = useState<HTMLElement | null>(null);
  const [bookingSummaryMount, setBookingSummaryMount] = useState<HTMLElement | null>(null);
  const [inquirySummaryMount, setInquirySummaryMount] = useState<HTMLElement | null>(null);
  const [retainerSummaryMount, setRetainerSummaryMount] = useState<HTMLElement | null>(null);
  const [paymentMount, setPaymentMount] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let planning: HTMLElement | null = null;
    let bookingSummary: HTMLElement | null = null;
    let inquirySummary: HTMLElement | null = null;
    let retainerSummary: HTMLElement | null = null;
    let payment: HTMLElement | null = null;
    let oldPaymentContent: HTMLElement | null = null;

    const main = document.querySelector("main");
    const panels = [...document.querySelectorAll("main > div")] as HTMLElement[];

    const trip = panels.find(
      (element) =>
        element.textContent?.includes("Trip details") && element.textContent?.includes("Trip information"),
    );
    if (trip) {
      hideInfo(trip, ["Travel timeframe", "Budget"]);
      const grid = trip.querySelector(
        ".md\\:grid-cols-\\[220px_minmax\\(0\\,1fr\\)\\] > div:nth-child(2) .grid",
      ) as HTMLElement | null;
      if (grid) {
        const byLabel = (label: string) => fieldBlock(trip, label);
        const order = [
          byLabel("Destination"),
          byLabel("Departure"),
          byLabel("Return"),
          byLabel("Trip Type"),
          byLabel("Travellers"),
        ].filter((element): element is HTMLElement => Boolean(element));
        for (const element of order) grid.appendChild(element);
      }
    }

    const inquiry = panels.find(
      (element) =>
        element.textContent?.includes("Inquiry details") && element.textContent?.includes("Source & intake"),
    );
    if (inquiry) {
      const grid = inquiry.querySelector(
        ".md\\:grid-cols-\\[220px_minmax\\(0\\,1fr\\)\\] > div:nth-child(2) .grid",
      ) as HTMLElement | null;
      if (grid) {
        inquirySummary = document.createElement("div");
        inquirySummary.className = "contents";
        grid.appendChild(inquirySummary);
        setInquirySummaryMount(inquirySummary);
      }
    }

    const retainer = panels.find(
      (element) =>
        element.textContent?.includes("Retainer details") &&
        element.textContent?.includes("Revisions included"),
    );
    if (retainer) {
      const grid = retainer.querySelector(
        ".md\\:grid-cols-\\[220px_minmax\\(0\\,1fr\\)\\] > div:nth-child(2) .grid",
      ) as HTMLElement | null;
      if (grid) {
        hideInfo(retainer, ["Revisions included", "Revisions used"]);
        retainerSummary = document.createElement("div");
        retainerSummary.className = "contents";
        grid.appendChild(retainerSummary);
        setRetainerSummaryMount(retainerSummary);
      }
    }

    const booking = panels.find(
      (element) =>
        element.textContent?.includes("Booking & planning") &&
        element.textContent?.includes("Booking information"),
    );
    if (booking) {
      hideInfo(booking, ["Proposal due", "Retainer", "Revisions used", "Revisions included"]);
      const aside = booking.querySelector(
        ".md\\:grid-cols-\\[220px_minmax\\(0\\,1fr\\)\\] > div:first-child",
      ) as HTMLElement | null;
      if (aside) {
        planning = document.createElement("div");
        planning.className = "mt-2";
        aside.appendChild(planning);
        setPlanningMount(planning);
      }
      const infoGrid = booking.querySelector(
        ".md\\:grid-cols-\\[220px_minmax\\(0\\,1fr\\)\\] > div:nth-child(2) .grid",
      ) as HTMLElement | null;
      if (infoGrid) {
        bookingSummary = document.createElement("div");
        bookingSummary.className = "contents";
        infoGrid.appendChild(bookingSummary);
        setBookingSummaryMount(bookingSummary);
      }
    }

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
      planning?.remove();
      bookingSummary?.remove();
      inquirySummary?.remove();
      retainerSummary?.remove();
      payment?.remove();
      if (oldPaymentContent) oldPaymentContent.style.display = "";
    };
  }, [travelFileId]);

  return {
    planningMount,
    bookingSummaryMount,
    inquirySummaryMount,
    retainerSummaryMount,
    paymentMount,
  };
}
