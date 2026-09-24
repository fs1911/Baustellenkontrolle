import { z } from "zod";
import { APP_ROLES, type AppRole } from "./enums";

/**
 * Spiegel der Datenbank-Berechtigungen (app.my_permissions()) für die UI-Steuerung.
 * Die Durchsetzung erfolgt ausschliesslich über RLS in der Datenbank.
 */
export const permissionsSchema = z.object({
  user_id: z.string().uuid(),
  is_admin: z.boolean(),
  is_catalog_editor: z.boolean(),
  group_roles: z.array(z.enum(APP_ROLES)),
  company_roles: z.array(z.object({ company_id: z.string().uuid(), role: z.enum(APP_ROLES) })),
  manageable_company_ids: z.array(z.string().uuid()),
  edit_site_ids: z.array(z.string().uuid()),
  work_site_ids: z.array(z.string().uuid()),
  viewer_site_ids: z.array(z.string().uuid()),
});
export type Permissions = z.infer<typeof permissionsSchema>;

export function allRoles(p: Permissions): AppRole[] {
  return Array.from(new Set<AppRole>([...p.group_roles, ...p.company_roles.map((r) => r.role)]));
}

export function hasAnyRole(p: Permissions, roles: readonly AppRole[]): boolean {
  return allRoles(p).some((r) => roles.includes(r));
}

/** Gruppenweite oder gesellschaftsweite Auswertungen (nicht für Poliere). */
export function canSeeAnalytics(p: Permissions): boolean {
  return hasAnyRole(p, ["admin", "group_ims", "viewer", "project_manager"]);
}

export function canSeeGroupAnalytics(p: Permissions): boolean {
  return p.group_roles.some((r) => r === "admin" || r === "group_ims" || r === "viewer");
}

export function canCreateInspections(p: Permissions): boolean {
  return p.edit_site_ids.length > 0;
}

export function canEditSite(p: Permissions, siteId: string): boolean {
  return p.edit_site_ids.includes(siteId);
}

export function canWorkSite(p: Permissions, siteId: string): boolean {
  return p.work_site_ids.includes(siteId);
}

export function canCreateSite(p: Permissions, companyId: string): boolean {
  return (
    p.manageable_company_ids.includes(companyId) ||
    p.company_roles.some((r) => r.company_id === companyId && r.role === "project_manager")
  );
}

/** Freie Empfänger (extern, CC/BCC) nur für Admin und Gruppen-IMS/SIBE. */
export function canSendToArbitraryRecipients(p: Permissions, companyId: string): boolean {
  return p.manageable_company_ids.includes(companyId);
}

export function isReadOnly(p: Permissions): boolean {
  return p.work_site_ids.length === 0 && !p.is_admin;
}
