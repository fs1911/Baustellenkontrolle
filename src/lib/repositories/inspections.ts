import "server-only";
import type { Tx } from "@/lib/db/client";
import type { InspectionStatus, InspectionType, ReportStatus } from "@/lib/domain/enums";

export interface InspectionListFilters {
  companyId?: string;
  siteId?: string;
  status?: InspectionStatus;
  type?: InspectionType;
  from?: string;
  to?: string;
  q?: string;
  inspectorId?: string;
}

export interface InspectionListRow {
  id: string;
  inspectedAt: Date;
  inspectionType: InspectionType;
  status: InspectionStatus;
  companyId: string;
  companyName: string;
  companyShortCode: string;
  siteId: string;
  siteName: string;
  siteNumber: string;
  inspectorName: string;
  positiveCount: number;
  negativeCount: number;
  improvementCount: number;
  criticalCount: number;
  reportStatus: ReportStatus | null;
  reportNumber: string | null;
}

export async function listInspections(tx: Tx, f: InspectionListFilters = {}, limit = 200): Promise<InspectionListRow[]> {
  const q = f.q?.trim() ? `%${f.q.trim()}%` : null;
  return tx<InspectionListRow[]>`
    select i.id, i.inspected_at, i.inspection_type, i.status, i.company_id, c.name as company_name, c.short_code as company_short_code,
           i.site_id, s.name as site_name, s.site_number, p.full_name as inspector_name,
           count(f.id) filter (where f.assessment = 'positive')::int as positive_count,
           count(f.id) filter (where f.assessment = 'negative')::int as negative_count,
           count(f.id) filter (where f.assessment = 'improvement')::int as improvement_count,
           count(f.id) filter (where f.risk_level = 'critical' and f.assessment <> 'positive')::int as critical_count,
           r.status as report_status, r.report_number
    from public.inspections i
    join public.companies c on c.id = i.company_id
    join public.construction_sites s on s.id = i.site_id
    join public.user_profiles p on p.id = i.inspector_id
    left join public.findings f on f.inspection_id = i.id and f.deleted_at is null
    left join public.generated_reports r on r.inspection_id = i.id
    where i.deleted_at is null
      ${f.companyId ? tx`and i.company_id = ${f.companyId}` : tx``}
      ${f.siteId ? tx`and i.site_id = ${f.siteId}` : tx``}
      ${f.status ? tx`and i.status = ${f.status}` : tx``}
      ${f.type ? tx`and i.inspection_type = ${f.type}` : tx``}
      ${f.inspectorId ? tx`and i.inspector_id = ${f.inspectorId}` : tx``}
      ${f.from ? tx`and i.inspected_at >= ${f.from}::date` : tx``}
      ${f.to ? tx`and i.inspected_at < ${f.to}::date + 1` : tx``}
      ${q ? tx`and (s.name ilike ${q} or s.site_number ilike ${q} or c.name ilike ${q} or i.area ilike ${q})` : tx``}
    group by i.id, c.id, s.id, p.id, r.id
    order by i.inspected_at desc
    limit ${limit}`;
}

export interface InspectionDetail {
  id: string;
  companyId: string;
  siteId: string;
  templateId: string | null;
  inspectionType: InspectionType;
  status: InspectionStatus;
  inspectedAt: Date;
  inspectorId: string;
  inspectorName: string;
  inspectorEmail: string;
  weather: string | null;
  area: string | null;
  notes: string | null;
  completedAt: Date | null;
  company: {
    name: string;
    shortCode: string;
    street: string | null;
    postalCode: string | null;
    city: string | null;
    primaryColor: string | null;
    emailSenderName: string | null;
    defaultDistribution: string[];
    reportDisclaimer: string | null;
    confidentialityNote: string | null;
    logoPath: string | null;
  };
  site: {
    name: string;
    siteNumber: string;
    street: string | null;
    postalCode: string | null;
    city: string | null;
    canton: string | null;
    projectNumber: string | null;
    projectName: string | null;
  };
  participants: { id: string; fullName: string; functionLabel: string | null; organisation: string | null }[];
  report: { id: string; status: ReportStatus; reportNumber: string; currentVersionId: string | null } | null;
}

export async function getInspection(tx: Tx, id: string): Promise<InspectionDetail | null> {
  const [row] = await tx<(Omit<InspectionDetail, "company" | "site" | "participants" | "report"> & Record<string, unknown>)[]>`
    select i.id, i.company_id, i.site_id, i.template_id, i.inspection_type, i.status, i.inspected_at, i.inspector_id,
           p.full_name as inspector_name, p.business_email as inspector_email, i.weather, i.area, i.notes, i.completed_at,
           c.name as c_name, c.short_code as c_short_code, c.street as c_street, c.postal_code as c_postal_code, c.city as c_city,
           c.primary_color as c_primary_color, c.email_sender_name as c_email_sender_name, c.default_distribution as c_default_distribution,
           c.report_disclaimer as c_report_disclaimer, c.confidentiality_note as c_confidentiality_note,
           (select l.storage_path from public.company_logos l where l.company_id = c.id and l.is_active limit 1) as c_logo_path,
           s.name as s_name, s.site_number as s_site_number, s.street as s_street, s.postal_code as s_postal_code, s.city as s_city,
           s.canton as s_canton, pr.project_number as s_project_number, pr.name as s_project_name,
           r.id as r_id, r.status as r_status, r.report_number as r_report_number, r.current_version_id as r_current_version_id
    from public.inspections i
    join public.companies c on c.id = i.company_id
    join public.construction_sites s on s.id = i.site_id
    left join public.projects pr on pr.id = s.project_id
    join public.user_profiles p on p.id = i.inspector_id
    left join public.generated_reports r on r.inspection_id = i.id
    where i.id = ${id} and i.deleted_at is null`;
  if (!row) return null;
  const participants = await tx<InspectionDetail["participants"]>`
    select id, full_name, function_label, organisation from public.inspection_participants where inspection_id = ${id} order by created_at`;
  const r = row as Record<string, unknown>;
  return {
    id: row.id,
    companyId: row.companyId,
    siteId: row.siteId,
    templateId: row.templateId,
    inspectionType: row.inspectionType,
    status: row.status,
    inspectedAt: row.inspectedAt,
    inspectorId: row.inspectorId,
    inspectorName: row.inspectorName,
    inspectorEmail: row.inspectorEmail,
    weather: row.weather,
    area: row.area,
    notes: row.notes,
    completedAt: row.completedAt,
    company: {
      name: r.cName as string,
      shortCode: r.cShortCode as string,
      street: r.cStreet as string | null,
      postalCode: r.cPostalCode as string | null,
      city: r.cCity as string | null,
      primaryColor: r.cPrimaryColor as string | null,
      emailSenderName: r.cEmailSenderName as string | null,
      defaultDistribution: (r.cDefaultDistribution as string[]) ?? [],
      reportDisclaimer: r.cReportDisclaimer as string | null,
      confidentialityNote: r.cConfidentialityNote as string | null,
      logoPath: r.cLogoPath as string | null,
    },
    site: {
      name: r.sName as string,
      siteNumber: r.sSiteNumber as string,
      street: r.sStreet as string | null,
      postalCode: r.sPostalCode as string | null,
      city: r.sCity as string | null,
      canton: r.sCanton as string | null,
      projectNumber: r.sProjectNumber as string | null,
      projectName: r.sProjectName as string | null,
    },
    participants,
    report: r.rId
      ? { id: r.rId as string, status: r.rStatus as ReportStatus, reportNumber: r.rReportNumber as string, currentVersionId: (r.rCurrentVersionId as string | null) ?? null }
      : null,
  };
}

export function formatSiteAddress(site: { street: string | null; postalCode: string | null; city: string | null }): string {
  return [site.street, [site.postalCode, site.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

export interface SelectableSite {
  id: string;
  companyId: string;
  name: string;
  siteNumber: string;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  projectNumber: string | null;
}

/** Gesellschaften und Baustellen, auf denen der Benutzer Kontrollen anlegen darf. */
export async function loadInspectionTargets(tx: Tx, editSiteIds: string[]) {
  const sites = await tx<SelectableSite[]>`
    select s.id, s.company_id, s.name, s.site_number, s.street, s.postal_code, s.city, p.project_number
    from public.construction_sites s left join public.projects p on p.id = s.project_id
    where s.deleted_at is null and s.is_active and s.id = any(${editSiteIds}::uuid[])
    order by s.name`;
  const companies = await tx<{ id: string; name: string; shortCode: string }[]>`
    select id, name, short_code from public.companies where deleted_at is null and is_active order by name`;
  return { sites, companies };
}

export async function listTemplates(tx: Tx) {
  return tx<{ id: string; name: string; companyId: string | null; inspectionType: InspectionType; items: TemplateItem[] }[]>`
    select id, name, company_id, inspection_type, items from public.inspection_templates where is_active order by name`;
}

/** Hinweis: JSON-Schlüssel werden beim Lesen in camelCase umgewandelt (postgres.camel). */
export interface TemplateItem {
  title: string;
  categoryCode: string;
  subcategoryCode: string | null;
  assessment: "positive" | "negative" | "improvement";
  riskLevel: "low" | "medium" | "high" | "critical" | null;
  action: string | null;
  responsibleRole: string | null;
}
