import "server-only";
import type { Tx } from "@/lib/db/client";
import type { AnalysisFinding } from "@/lib/domain/recurrence";

/** Lädt Feststellungen für Wiederholungs-/Trendanalysen. Unter withUser gelten RLS-Grenzen automatisch. */
export async function loadAnalysisFindings(tx: Tx, sinceDays: number): Promise<AnalysisFinding[]> {
  const rows = await tx<(Omit<AnalysisFinding, "createdAt"> & { createdAt: Date })[]>`
    select f.id, f.company_id, c.name as company_name, f.site_id, s.name as site_name, s.project_id,
           f.category_id, cat.name as category_name, f.subcategory_id, sub.name as subcategory_name,
           f.assessment, f.risk_level, f.responsible_role, f.trade, f.title, f.description, f.status, f.created_at,
           exists (select 1 from public.corrective_actions a where a.finding_id = f.id
                   and a.status in ('open', 'in_progress') and a.due_date < (now() at time zone 'Europe/Zurich')::date) as overdue,
           exists (select 1 from public.corrective_actions a where a.finding_id = f.id and a.completed_at is not null
                   and a.due_date is not null and (a.completed_at at time zone 'Europe/Zurich')::date > a.due_date) as completed_late
    from public.findings f
    join public.inspections i on i.id = f.inspection_id and i.deleted_at is null
    join public.companies c on c.id = f.company_id
    join public.construction_sites s on s.id = f.site_id
    left join public.finding_categories cat on cat.id = f.category_id
    left join public.finding_subcategories sub on sub.id = f.subcategory_id
    where f.deleted_at is null and f.created_at >= now() - make_interval(days => ${sinceDays})`;
  return rows.map((r) => ({ ...r, createdAt: new Date(r.createdAt) }));
}
