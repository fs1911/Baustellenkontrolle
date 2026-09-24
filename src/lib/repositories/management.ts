import "server-only";
import type { Tx } from "@/lib/db/client";
import type { DashboardFilters } from "./dashboard";
import { loadKpis, type Kpis } from "./dashboard";

export interface CompanyComparison {
  id: string; name: string; inspections: number; findings: number; positive: number; deviations: number;
  criticalOpen: number; overdue: number; completionRate: number | null; avgDays: number | null;
}
export interface MonthPoint { month: string; label: string; open: number; overdue: number }
export interface SystemicTheme { title: string; scope: string; insight: string; score: number; memberCount: number; recommendation: string | null }
export interface CriticalCase { id: string; inspectionId: string; title: string; siteName: string; companyName: string; createdAt: Date; status: string; dueDate: string | null; overdue: boolean }

export interface ManagementData {
  filters: DashboardFilters;
  kpis: Kpis;
  companies: CompanyComparison[];
  months: MonthPoint[];
  themes: SystemicTheme[];
  critical: CriticalCase[];
}

export async function loadManagementData(tx: Tx, f: DashboardFilters): Promise<ManagementData> {
  const kpis = await loadKpis(tx, f);
  const companies = await tx<CompanyComparison[]>`
    select c.id, c.name,
      (select count(*)::int from public.inspections i where i.company_id = c.id and i.deleted_at is null and i.inspected_at >= ${f.from}::date and i.inspected_at < ${f.to}::date + 1) as inspections,
      count(f.id)::int as findings,
      count(f.id) filter (where f.assessment = 'positive')::int as positive,
      count(f.id) filter (where f.assessment <> 'positive')::int as deviations,
      count(f.id) filter (where f.risk_level = 'critical' and f.status in ('open','in_progress') and f.assessment <> 'positive')::int as critical_open,
      (select count(*)::int from public.corrective_actions a where a.company_id = c.id and a.status in ('open','in_progress') and a.due_date < (now() at time zone 'Europe/Zurich')::date) as overdue,
      (select case when count(*) = 0 then null else (count(*) filter (where a.status in ('resolved','verified','closed')))::float / count(*) end
         from public.corrective_actions a join public.findings f2 on f2.id = a.finding_id join public.inspections i2 on i2.id = f2.inspection_id
         where a.company_id = c.id and i2.inspected_at >= ${f.from}::date and i2.inspected_at < ${f.to}::date + 1) as completion_rate,
      (select avg(extract(epoch from (a.completed_at - a.created_at)) / 86400)::float from public.corrective_actions a
         where a.company_id = c.id and a.completed_at is not null and a.created_at >= ${f.from}::date) as avg_days
    from public.companies c
    left join public.inspections i on i.company_id = c.id and i.deleted_at is null and i.inspected_at >= ${f.from}::date and i.inspected_at < ${f.to}::date + 1
    left join public.findings f on f.inspection_id = i.id and f.deleted_at is null
    where c.deleted_at is null ${f.companyId ? tx`and c.id = ${f.companyId}` : tx``}
    group by c.id order by c.name`;
  const months = await tx<MonthPoint[]>`
    with m as (
      select generate_series(date_trunc('month', ${f.from}::date), date_trunc('month', ${f.to}::date), interval '1 month') as month_start
    )
    select to_char(m.month_start, 'YYYY-MM') as month, to_char(m.month_start, 'MM.YYYY') as label,
      (select count(*)::int from public.corrective_actions a
         where a.created_at < m.month_start + interval '1 month' and (a.completed_at is null or a.completed_at >= m.month_start + interval '1 month')
         ${f.companyId ? tx`and a.company_id = ${f.companyId}` : tx``} ${f.siteId ? tx`and a.site_id = ${f.siteId}` : tx``}) as open,
      (select count(*)::int from public.corrective_actions a
         where a.created_at < m.month_start + interval '1 month' and (a.completed_at is null or a.completed_at >= m.month_start + interval '1 month')
           and a.due_date < least((m.month_start + interval '1 month')::date, (now() at time zone 'Europe/Zurich')::date)
         ${f.companyId ? tx`and a.company_id = ${f.companyId}` : tx``} ${f.siteId ? tx`and a.site_id = ${f.siteId}` : tx``}) as overdue
    from m order by m.month_start`;
  const themes = await tx<SystemicTheme[]>`
    select title, scope, insight, score::float as score, member_count, recommendation from public.recurring_issue_clusters
    where status = 'active' and scope in ('company','group') ${f.companyId ? tx`and (company_id = ${f.companyId} or company_id is null)` : tx``}
    order by score desc limit 10`;
  const critical = await tx<CriticalCase[]>`
    select f.id, f.inspection_id, f.title, s.name as site_name, c.name as company_name, f.created_at, f.status,
      (select min(a.due_date)::text from public.corrective_actions a where a.finding_id = f.id and a.status in ('open','in_progress')) as due_date,
      exists (select 1 from public.corrective_actions a where a.finding_id = f.id and a.status in ('open','in_progress') and a.due_date < (now() at time zone 'Europe/Zurich')::date) as overdue
    from public.findings f join public.inspections i on i.id = f.inspection_id and i.deleted_at is null
    join public.construction_sites s on s.id = f.site_id join public.companies c on c.id = f.company_id
    where f.deleted_at is null and f.assessment = 'negative' and f.risk_level = 'critical' and f.status in ('open','in_progress')
      ${f.companyId ? tx`and f.company_id = ${f.companyId}` : tx``}
    order by f.created_at limit 20`;
  return { filters: f, kpis, companies, months, themes, critical };
}
