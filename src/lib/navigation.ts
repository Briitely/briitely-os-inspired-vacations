import "server-only";
import { can } from "@/lib/auth/permissions";
import { clientConfig } from "@/config/client.config";
import { navigation, type NavItem } from "@/config/navigation";

import type { VisibleNavItem } from "@/lib/navigation-active";

export type { VisibleNavItem };

function featureOn(feature: NavItem["feature"]) {
  if (!feature) return true;
  const setting = clientConfig.features[feature] as { enabled?: boolean } | undefined;
  return Boolean(setting?.enabled);
}

/**
 * The menu this person may see, worked out on the server before it reaches the
 * browser. An item needs its permission and its feature; a section whose
 * sub-pages are all hidden is hidden too.
 */
export function visibleNavigation(role: string | null | undefined, items: NavItem[] = navigation): VisibleNavItem[] {
  const visible: VisibleNavItem[] = [];
  for (const item of items) {
    if (item.permission && !can(role, item.permission)) continue;
    if (!featureOn(item.feature)) continue;
    const entry: VisibleNavItem = { label: item.label, href: item.href, ...(item.match ? { match: item.match } : {}) };
    if (item.children) {
      const children = visibleNavigation(role, item.children);
      if (children.length === 0) continue;
      entry.children = children;
    }
    visible.push(entry);
  }
  return visible;
}

export { activeHref, isActive } from "@/lib/navigation-active";
