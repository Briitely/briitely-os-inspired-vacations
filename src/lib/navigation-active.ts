// Which menu item is the current page. Kept apart from lib/navigation.ts so the
// browser can use it without loading the full (unfiltered) menu config.

/** A menu item as the browser gets it: already filtered, no permission or feature names. */
export type VisibleNavItem = { label: string; href: string; match?: string[]; children?: VisibleNavItem[] };

function matches(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`);
}

/**
 * The href of the menu item for the current page: the longest `href` or `match`
 * prefix of the path, so /orders/new marks "New order", not "Order history" at /orders.
 */
export function activeHref(items: VisibleNavItem[], pathname: string): string | null {
  let best: { href: string; length: number } | null = null;
  const visit = (list: VisibleNavItem[]) => {
    for (const item of list) {
      for (const prefix of [item.href, ...(item.match ?? [])]) {
        if (matches(pathname, prefix) && (!best || prefix.length > best.length)) best = { href: item.href, length: prefix.length };
      }
      if (item.children) visit(item.children);
    }
  };
  visit(items);
  return best ? (best as { href: string }).href : null;
}

/** True when this item, or one of its sub-pages, is the current page. */
export function isActive(item: VisibleNavItem, active: string | null): boolean {
  if (!active) return false;
  return item.href === active || Boolean(item.children?.some((child) => isActive(child, active)));
}
