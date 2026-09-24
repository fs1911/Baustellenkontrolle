import type { Permissions } from "@/lib/domain/permissions";
import { canCreateInspections, canSeeAnalytics, canSeeGroupAnalytics, hasAnyRole } from "@/lib/domain/permissions";

export type NavIcon =
  | "dashboard" | "inspections" | "actions" | "findings" | "recurring" | "sites" | "reports" | "management" | "admin" | "settings";

export interface NavItem { href: string; label: string; icon: NavIcon }

export function navItems(p: Permissions): NavItem[] {
  const items: NavItem[] = [];
  if (canSeeAnalytics(p)) items.push({ href: "/dashboard", label: "Dashboard", icon: "dashboard" });
  items.push({ href: "/kontrollen", label: "Kontrollen", icon: "inspections" });
  if (p.work_site_ids.length > 0) items.push({ href: "/massnahmen", label: "Massnahmen", icon: "actions" });
  items.push({ href: "/feststellungen", label: "Feststellungen", icon: "findings" });
  if (canSeeAnalytics(p)) items.push({ href: "/wiederkehrend", label: "Wiederkehrende Abweichungen", icon: "recurring" });
  items.push({ href: "/baustellen", label: "Baustellen", icon: "sites" });
  items.push({ href: "/berichte", label: "Berichte", icon: "reports" });
  if (canSeeGroupAnalytics(p) || hasAnyRole(p, ["viewer"])) items.push({ href: "/management", label: "Management", icon: "management" });
  if (p.is_admin || p.is_catalog_editor) items.push({ href: "/admin", label: "Verwaltung", icon: "admin" });
  return items;
}

export function canQuickCreate(p: Permissions) {
  return canCreateInspections(p);
}
