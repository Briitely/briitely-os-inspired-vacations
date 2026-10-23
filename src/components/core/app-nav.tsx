"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut, Menu, UserRound, X } from "lucide-react";
import { activeHref, isActive, type VisibleNavItem } from "@/lib/navigation-active";

/*
 * Briitely OS navigation menu (docs/navigation-menu.md). The items arrive
 * already filtered for this person on the server (lib/navigation.ts).
 *
 * 1024px and wider: a row of sections; a section with sub-pages opens a
 * dropdown on click or tap (never hover, which tablets can't do), and the
 * user block is a small menu on the right (just the initial under 1280px, to
 * leave room for seven sections on a tablet held sideways).
 * Under 1024px: a "Menu" button opens a panel from the left with the sections
 * as accordions (the current one open) and the user block at the bottom.
 * Styles: os-nav-* in src/styles/briitely-os.css.
 */

type User = { name: string; email: string; roleLabel: string };

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function AppNav({ items, user, onSignOut }: { items: VisibleNavItem[]; user: User; onSignOut: () => void }) {
  const pathname = usePathname();
  const active = activeHref(items, pathname);
  const baseId = useId();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const rowRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const dropdownButtons = useRef(new Map<string, HTMLButtonElement>());
  const wasPanelOpen = useRef(false);

  // Going to a page closes any open dropdown or panel.
  const [shownPath, setShownPath] = useState(pathname);
  if (shownPath !== pathname) { setShownPath(pathname); setOpenMenu(null); setPanelOpen(false); }

  // Dropdowns close on a click or tap outside them, and on Escape (focus goes back to their button).
  useEffect(() => {
    if (!openMenu) return;
    const onPointer = (event: PointerEvent) => { if (!rowRef.current?.contains(event.target as Node)) setOpenMenu(null); };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      dropdownButtons.current.get(openMenu)?.focus();
      setOpenMenu(null);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onPointer); document.removeEventListener("keydown", onKey); };
  }, [openMenu]);

  // The panel locks page scrolling, keeps focus inside it, and closes on Escape.
  useEffect(() => {
    if (!panelOpen) {
      if (wasPanelOpen.current) menuButtonRef.current?.focus();
      wasPanelOpen.current = false;
      return;
    }
    wasPanelOpen.current = true;
    const panel = panelRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setPanelOpen(false); return; }
      if (event.key !== "Tab" || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKey); };
  }, [panelOpen]);

  function openPanel() {
    // The current page's section starts open.
    setOpenSections(new Set(items.filter((item) => item.children && isActive(item, active)).map((item) => item.label)));
    setOpenMenu(null);
    setPanelOpen(true);
  }

  function toggleSection(label: string) {
    setOpenSections((current) => {
      const next = new Set(current);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  }

  const current = (href: string) => (href === active ? "page" as const : undefined);
  const initial = (user.name || user.email || "U").trim().charAt(0).toUpperCase();
  const firstName = (user.name || user.email).split(/[\s@]/)[0];
  const userMenuId = `${baseId}-user`;

  return (
    <>
      {/* Computers and tablets held sideways */}
      <div ref={rowRef} className="hidden min-w-0 flex-1 items-center justify-between gap-3 lg:flex">
        <nav aria-label="Main" className="min-w-0">
          <ul className="flex items-center gap-0.5">
            {items.map((item, index) => {
              if (!item.children) {
                return <li key={item.label}><Link href={item.href} className="os-nav-link" aria-current={current(item.href)}>{item.label}</Link></li>;
              }
              const id = `${baseId}-${item.label.replace(/\W+/g, "-")}`;
              const open = openMenu === item.label;
              return (
                <li key={item.label} className="relative">
                  <button
                    type="button"
                    ref={(el) => { if (el) dropdownButtons.current.set(item.label, el); }}
                    className="os-nav-link"
                    data-active={isActive(item, active) ? "" : undefined}
                    aria-expanded={open}
                    aria-controls={id}
                    onClick={() => setOpenMenu(open ? null : item.label)}
                  >
                    {item.label}<ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
                  </button>
                  {open && (
                    // The last sections open toward the left so they stay on screen.
                    <ul id={id} className={index >= items.length - 2 ? "os-nav-dropdown os-nav-dropdown-right" : "os-nav-dropdown"}>
                      {item.children.map((child) => (
                        <li key={child.href + child.label}>
                          <Link href={child.href} className="os-nav-dropdown-link" aria-current={current(child.href)} onClick={() => setOpenMenu(null)}>{child.label}</Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="relative shrink-0">
          <button
            type="button"
            ref={(el) => { if (el) dropdownButtons.current.set("__user", el); }}
            className="os-nav-link"
            aria-expanded={openMenu === "__user"}
            aria-controls={userMenuId}
            aria-label={`${user.name || user.email}, ${user.roleLabel}: account menu`}
            onClick={() => setOpenMenu(openMenu === "__user" ? null : "__user")}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground" aria-hidden="true">{initial}</span>
            <span className="hidden max-w-[8rem] truncate xl:inline">{firstName}</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${openMenu === "__user" ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          {openMenu === "__user" && (
            <div id={userMenuId} className="os-nav-dropdown os-nav-dropdown-right w-64">
              <div className="px-3 py-2">
                <p className="truncate text-sm font-semibold text-foreground">{user.name || user.email}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                <p className="mt-1 text-xs font-semibold text-primary">{user.roleLabel}</p>
              </div>
              <div className="my-1 border-t border-border" />
              <Link href="/account" className="os-nav-dropdown-link" aria-current={pathname.startsWith("/account") ? "page" : undefined} onClick={() => setOpenMenu(null)}><UserRound className="h-4 w-4" aria-hidden="true" />My Profile</Link>
              <button type="button" className="os-nav-dropdown-link" onClick={() => { setOpenMenu(null); onSignOut(); }}><LogOut className="h-4 w-4" aria-hidden="true" />Sign Out</button>
            </div>
          )}
        </div>
      </div>

      {/* Tablets held upright and phones */}
      <div className="lg:hidden">
      <button
        ref={menuButtonRef}
        type="button"
        className="os-nav-menu-button"
        aria-expanded={panelOpen}
        aria-controls={`${baseId}-panel`}
        onClick={openPanel}
      >
        <Menu className="h-5 w-5" aria-hidden="true" />Menu
      </button>
      </div>

      {panelOpen && (
        <div className="lg:hidden">
          <div className="os-nav-backdrop" aria-hidden="true" onClick={() => setPanelOpen(false)} />
          <div ref={panelRef} id={`${baseId}-panel`} className="os-nav-panel" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-border pl-4 pr-2">
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">Menu</p>
              <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-md hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Close menu" onClick={() => setPanelOpen(false)}>
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <nav aria-label="Main" className="flex-1 overflow-y-auto py-2">
              <ul>
                {items.map((item) => {
                  if (!item.children) {
                    return (
                      <li key={item.label}>
                        <Link href={item.href} className="os-nav-panel-link" aria-current={current(item.href)} onClick={() => setPanelOpen(false)}>
                          {item.label}{item.href === active && <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />}
                        </Link>
                      </li>
                    );
                  }
                  const id = `${baseId}-panel-${item.label.replace(/\W+/g, "-")}`;
                  const open = openSections.has(item.label);
                  return (
                    <li key={item.label}>
                      <button type="button" className="os-nav-panel-link" data-active={isActive(item, active) ? "" : undefined} aria-expanded={open} aria-controls={id} onClick={() => toggleSection(item.label)}>
                        {item.label}<ChevronDown className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
                      </button>
                      {open && (
                        <ul id={id}>
                          {item.children.map((child) => (
                            <li key={child.href + child.label}>
                              <Link href={child.href} className="os-nav-panel-link os-nav-panel-sub" aria-current={current(child.href)} onClick={() => setPanelOpen(false)}>
                                {child.label}{child.href === active && <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="shrink-0 border-t border-border py-2">
              <div className="px-4 py-2">
                <p className="truncate text-sm font-semibold text-foreground">{user.name || user.email}</p>
                <p className="text-xs text-muted-foreground">{user.roleLabel}</p>
              </div>
              <Link href="/account" className="os-nav-panel-link" aria-current={pathname.startsWith("/account") ? "page" : undefined} onClick={() => setPanelOpen(false)}>
                <span className="flex items-center gap-3"><UserRound className="h-5 w-5" aria-hidden="true" />My Profile</span>
              </Link>
              <button type="button" className="os-nav-panel-link" onClick={() => { setPanelOpen(false); onSignOut(); }}>
                <span className="flex items-center gap-3"><LogOut className="h-5 w-5" aria-hidden="true" />Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
