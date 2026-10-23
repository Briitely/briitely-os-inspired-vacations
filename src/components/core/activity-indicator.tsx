"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/*
 * Briitely OS "the system is thinking" standard. Mounted once in app/layout.tsx,
 * so every page gets it without extra code:
 *
 * - A thin bar across the top of the screen starts the moment someone clicks a
 *   link, and finishes when the new page arrives.
 * - The same bar shows when code moves to another page (router.push) and while
 *   anything a click started is still working, so every click gets a response.
 * - The button that was clicked shows a spinning wheel while it waits.
 *
 * Buttons can also show the wheel directly with <Button loading>.
 */
const START_EVENT = "briitely:navigation-start";
const ACTIVITY_EVENT = "briitely:activity";
// Requests that start this soon after a click count as work the click started.
const CLICK_WINDOW_MS = 1000;
// If a navigation never lands (cancelled click, same page), hide the bar anyway.
const GIVE_UP_MS = 15000;

let lastClickAt = 0;
let clickRequests = 0;
let fetchTracked = false;

/** Starts the bar by hand, for waits the indicator can't see. */
export function startNavigationProgress() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(START_EVENT));
}

function announce() {
  window.dispatchEvent(new Event(ACTIVITY_EVENT));
}

// Same format for the browser's address and the router's, so they compare.
function routeKey(pathname: string, search: string) {
  const query = new URLSearchParams(search).toString();
  return query ? `${pathname}?${query}` : pathname;
}

// The router loads a new page with a request flagged "rsc". Seeing one for a
// different page means a navigation has started, however it was triggered
// (a link, router.push, the back button).
function isPageRequest(input: Parameters<typeof fetch>[0], init?: RequestInit) {
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  if (headers.get("rsc") !== "1" || headers.has("next-router-prefetch") || headers.has("next-action")) return false;
  const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
  url.searchParams.delete("_rsc");
  return routeKey(url.pathname, url.search) !== routeKey(window.location.pathname, window.location.search);
}

// Counts the requests a click starts, so the bar and the button know when the
// work is finished. Other requests pass straight through.
function trackClickRequests() {
  if (fetchTracked) return;
  fetchTracked = true;
  const original = window.fetch.bind(window);
  window.fetch = ((...args: Parameters<typeof fetch>) => {
    try { if (isPageRequest(...args)) startNavigationProgress(); } catch { /* never block a request */ }
    if (Date.now() - lastClickAt > CLICK_WINDOW_MS) return original(...args);
    clickRequests += 1;
    announce();
    return original(...args).finally(() => { clickRequests -= 1; announce(); });
  }) as typeof fetch;
}

function isPageLinkClick(target: Element) {
  const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
  if (!anchor || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return false;
  const next = new URL(anchor.href, window.location.href);
  if (next.origin !== window.location.origin) return false;
  // Same page or just a #section jump: nothing to wait for.
  return next.pathname !== window.location.pathname || next.search !== window.location.search;
}

function ActivityBar() {
  const currentRoute = routeKey(usePathname(), useSearchParams().toString());
  // The page someone clicked away from: the bar runs until the route changes.
  const [leaving, setLeaving] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const giveUp = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The new page has arrived: stop the navigation part of the bar.
  const [shownRoute, setShownRoute] = useState(currentRoute);
  if (shownRoute !== currentRoute) { setShownRoute(currentRoute); setLeaving(null); }

  useEffect(() => {
    trackClickRequests();
    let clicked: HTMLButtonElement | null = null;
    const observer = new MutationObserver(() => refreshButton());

    // The clicked button spins while it's disabled waiting on the work it started.
    function refreshButton() {
      if (!clicked) return;
      const busy = clicked.isConnected && clicked.disabled && clickRequests > 0;
      if (busy) clicked.setAttribute("data-os-busy", "");
      else clicked.removeAttribute("data-os-busy");
      if (!busy && Date.now() - lastClickAt > CLICK_WINDOW_MS) { observer.disconnect(); clicked = null; }
    }

    const startNavigation = () => {
      setLeaving(routeKey(window.location.pathname, window.location.search));
      if (giveUp.current) clearTimeout(giveUp.current);
      giveUp.current = setTimeout(() => setLeaving(null), GIVE_UP_MS);
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target || event.button !== 0) return;
      lastClickAt = Date.now();
      if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && isPageLinkClick(target)) startNavigation();
      const button = target.closest("button");
      if (button && !button.disabled) {
        clicked?.removeAttribute("data-os-busy");
        observer.disconnect();
        clicked = button;
        observer.observe(button, { attributes: true, attributeFilter: ["disabled"] });
      }
    };
    const onActivity = () => { setWorking(clickRequests > 0); refreshButton(); };

    document.addEventListener("click", onClick, true);
    window.addEventListener(START_EVENT, startNavigation);
    window.addEventListener(ACTIVITY_EVENT, onActivity);
    return () => {
      observer.disconnect();
      if (giveUp.current) clearTimeout(giveUp.current);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(START_EVENT, startNavigation);
      window.removeEventListener(ACTIVITY_EVENT, onActivity);
    };
  }, []);

  const running = leaving === currentRoute || working;
  // Always rendered: when the work ends the bar fills and fades out (see CSS).
  return <div className="os-progress" data-state={running ? "running" : "done"} role="progressbar" aria-label="Working" aria-hidden={!running} aria-busy={running}><div className="os-progress-bar" /></div>;
}

export function ActivityIndicator() {
  return <Suspense fallback={null}><ActivityBar /></Suspense>;
}
