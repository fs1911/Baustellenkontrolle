import "server-only";
import type { Tx } from "@/lib/db/client";
import type { ActionStatus, Assessment, InspectionType, RiskLevel } from "@/lib/domain/enums";

export interface DashboardFilters {
  companyId?: string;
  siteId?: string;
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  type?: InspectionType;
  categoryId?: string;
  riskLevel?: RiskLevel;
  status?: ActionStatus;
  responsibleRole?: string;
  inspectorId?: string;
}

/** Gemeinsamer Filter auf Feststellungen (f) und Kontrollen (i). RLS gilt zusätzlich. */
function where(tx: Tx, f: DashboardFilters, range: { from: string; to: string } = f) {
  return tx`
    f.deleted_at is null and i.deleted_at is null
    and i.inspected_at >= ${range.from}::date and i.inspected_at < ${range.to}::date + 1
    ${f.companyId ? tx`and f.company_id = ${f.companyId}` : tx``}
    ${f.siteId ? tx`and f.site_id = ${f.siteId}` : tx``}
    ${f.type ? tx`and i.inspection_type = ${f.type}` : tx``}
    ${f.categoryId ? tx`and f.category_id = ${f.categoryId}` : tx``}
    ${f.riskLevel ? tx`and f.risk_level = ${f.riskLevel}` : tx``}
    ${f.status ? tx`and f.status = ${f.status}` : tx``}
    ${f.responsibleRole ? tx`and f.responsible_role ilike ${f.responsibleRole}` : tx``}
    ${f.inspectorId ? tx`and i.inspector_id = ${f.inspectorId}` : tx``}`;
}

const TODAY = `(now() at time zone 'Europe/Zurich')::date`;

export interface Kpis {
  inspections: number;
  findings: number;
  positive: number;
  negative: number;
  improvement: number;
  openActions: number;
  overdueActions: number;
  criticalDeviations: number;
  completionRate: number | null;
  avgDaysToCompletion: number | null;
  deviationsPrev: number;
  deviationsCurrent: number;
  recurringClusters: number;
}

function previousRange(from: string, to: string) {
  const f = new Date(`${from}T00:00:00Z`);
  const t = new Date(`${to}T00:00:00Z`);
  const days = Math.round((t.getTime() - f.getTime()) / 86400000) + 1;
  const pTo = new Date(f.getTime() - 86400000);
  const pFrom = new Date(pTo.getTime() - (days - 1) * 86400000);
  return { from: pFrom.toISOString().slice(0, 10), to: pTo.toISOString().slice(0, 10) };
}

export async function loadKpis(tx: Tx, f: DashboardFilters): Promise<Kpis> {
  const [a] = await tx<Omit<Kpis, "deviationsPrev" | "deviationsCurrent" | "recurringClusters" | "inspections" | "completionRate" | "avgDaysToCompletion">[]>`
    select count(*)::int as findings,
           count(*) filter (where f.assessment = 'positive')::int as positive,
           count(*) filter (where f.assessment = 'negative')::int as negative,
           count(*) filter (where f.assessment = 'improvement')::int as improvement,
           count(*) filter (where f.assessment = 'negative' and f.risk_level = 'critical')::int as critical_deviations,
           (select count(*)::int from public.corrective_actions ca
              where ca.finding_id = any(array_agg(f.id)) and ca.status in ('open','in_progress')) as open_actions,
           (select count(*)::int from public.corrective_actions ca
              where ca.finding_id = any(array_agg(f.id)) and ca.status in ('open','in_progress') and ca.due_date < ${tx.unsafe(TODAY)}) as overdue_actions
    from public.findings f join public.inspections i on i.id = f.inspection_id
    where ${where(tx, f)}`;
  const [insp] = await tx<{ n: number }[]>`
    select count(distinct i.id)::int as n from public.inspections i left join public.findings f on f.inspection_id = i.id and f.deleted_at is null
    where i.deleted_at is null and i.inspected_at >= ${f.from}::date and i.inspected_at < ${f.to}::date + 1
      ${f.companyId ? tx`and i.company_id = ${f.companyId}` : tx``}
      ${f.siteId ? tx`and i.site_id = ${f.siteId}` : tx``}
      ${f.type ? tx`and i.inspection_type = ${f.type}` : tx``}
      ${f.inspectorId ? tx`and i.inspector_id = ${f.inspectorId}` : tx``}`;
  const [done] = await tx<{ total: number; completed: number; avgDays: number | null }[]>`
    select count(*)::int as total,
           count(*) filter (where ca.status in ('resolved','verified','closed'))::int as completed,
           avg(extract(epoch from (ca.completed_at - ca.created_at)) / 86400) filter (where ca.completed_at is not null)::float as avg_days
    from public.corrective_actions ca join public.findings f on f.id = ca.finding_id join public.inspections i on i.id = f.inspection_id
    where ${where(tx, f)}`;
  const prev = previousRange(f.from, f.to);
  const [dev] = await tx<{ current: number; previous: number }[]>`
    select
      (select count(*)::int from public.findings f join public.inspections i on i.id = f.inspection_id where ${where(tx, f)} and f.assessment <> 'positive') as current,
      (select count(*)::int from public.findings f join public.inspections i on i.id = f.inspection_id where ${where(tx, f, prev)} and f.assessment <> 'positive') as previous`;
  const [rec] = await tx<{ n: number }[]>`
    select count(*)::int as n from public.recurring_issue_clusters c where c.status = 'active'
      ${f.companyId ? tx`and (c.company_id = ${f.companyId} or c.company_id is null)` : tx``}
      ${f.siteId ? tx`and c.site_id = ${f.siteId}` : tx``}
      ${f.categoryId ? tx`and c.category_id = ${f.categoryId}` : tx``}`;
  return {
    ...a,
    inspections: insp.n,
    completionRate: done.total ? done.completed / done.total : null,
    avgDaysToCompletion: done.avgDays,
    deviationsCurrent: dev.current,
    deviationsPrev: dev.previous,
    recurringClusters: rec.n,
  };
}

export interface WeeklyPoint { week: string; label: string; negative: number; improvement: number; positive: number }

export async function loadWeekly(tx: Tx, f: DashboardFilters): Promise<WeeklyPoint[]> {
  const rows = await tx<{ week: string; assessment: Assessment; n: number }[]>`
    select to_char(date_trunc('week', i.inspected_at at time zone 'Europe/Zurich'), 'YYYY-MM-DD') as week, f.assessment, count(*)::int as n
    from public.findings f join public.inspections i on i.id = f.inspection_id
    where ${where(tx, f)} group by 1, 2 order by 1`;
  const weeks: WeeklyPoint[] = [];
  const start = new Date(`${f.from}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  for (let d = new Date(start); d <= new Date(`${f.to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 7)) {
    const key = d.toISOString().slice(0, 10);
    weeks.push({ week: key, label: `${key.slice(8, 10)}.${key.slice(5, 7)}.`, negative: 0, improvement: 0, positive: 0 });
  }
  for (const r of rows) {
    const w = weeks.find((x) => x.week === r.week);
    if (w) w[r.assessment] = r.n;
  }
  return weeks;
}

export async function loadCategoryCounts(tx: Tx, f: DashboardFilters) {
  return tx<{ id: string; name: string; n: number }[]>`
    select c.id, c.name, count(*)::int as n
    from public.findings f join public.inspections i on i.id = f.inspection_id join public.finding_categories c on c.id = f.category_id
    where ${where(tx, f)} and f.assessment <> 'positive'
    group by c.id, c.name order by n desc, c.name limit 10`;
}

export async function loadSubcategoryCounts(tx: Tx, f: DashboardFilters) {
  return tx<{ id: string; name: string; categoryName: string; n: number }[]>`
    select s.id, s.name, c.name as category_name, count(*)::int as n
    from public.findings f join public.inspections i on i.id = f.inspection_id
    join public.finding_subcategories s on s.id = f.subcategory_id join public.finding_categories c on c.id = s.category_id
    where ${where(tx, f)} and f.assessment <> 'positive'
    group by s.id, s.name, c.name order by n desc, s.name limit 8`;
}

export async function loadCompanyAssessment(tx: Tx, f: DashboardFilters) {
  return tx<{ id: string; name: string; shortCode: string; negative: number; improvement: number; positive: number }[]>`
    select co.id, co.name, co.short_code,
           count(*) filter (where f.assessment = 'negative')::int as negative,
           count(*) filter (where f.assessment = 'improvement')::int as improvement,
           count(*) filter (where f.assessment = 'positive')::int as positive
    from public.findings f join public.inspections i on i.id = f.inspection_id join public.companies co on co.id = f.company_id
    where ${where(tx, f)} group by co.id order by co.name`;
}

export async function loadHeatmap(tx: Tx, f: DashboardFilters) {
  return tx<{ categoryId: string; categoryName: string; siteId: string; siteName: string; n: number }[]>`
    select c.id as category_id, c.name as category_name, s.id as site_id, s.name as site_name, count(*)::int as n
    from public.findings f join public.inspections i on i.id = f.inspection_id
    join public.finding_categories c on c.id = f.category_id join public.construction_sites s on s.id = f.site_id
    where ${where(tx, f)} and f.assessment <> 'positive'
    group by c.id, c.name, s.id, s.name`;
}

export async function loadRiskMatrix(tx: Tx, f: DashboardFilters) {
  return tx<{ riskLevel: RiskLevel; bucket: "open" | "in_progress" | "done"; n: number }[]>`
    select f.risk_level, case when f.status = 'open' then 'open' when f.status = 'in_progress' then 'in_progress' else 'done' end as bucket, count(*)::int as n
    from public.findings f join public.inspections i on i.id = f.inspection_id
    where ${where(tx, f)} and f.assessment <> 'positive' and f.risk_level is not null
    group by 1, 2`;
}

export interface OverdueRow { actionId: string; findingId: string; inspectionId: string; title: string; description: string; siteName: string; responsible: string | null; dueDate: string; daysOverdue: number; riskLevel: RiskLevel | null; status: ActionStatus }

export async function loadOverdue(tx: Tx, f: DashboardFilters, limit = 10): Promise<OverdueRow[]> {
  return tx<OverdueRow[]>`
    select ca.id as action_id, f.id as finding_id, f.inspection_id, f.title, ca.description, s.name as site_name,
           coalesce(ca.responsible_role, f.responsible_role) as responsible, ca.due_date::text as due_date,
           (${tx.unsafe(TODAY)} - ca.due_date)::int as days_overdue, f.risk_level, ca.status
    from public.corrective_actions ca join public.findings f on f.id = ca.finding_id join public.inspections i on i.id = f.inspection_id
    join public.construction_sites s on s.id = f.site_id
    where ${where(tx, f)} and ca.status in ('open','in_progress') and ca.due_date < ${tx.unsafe(TODAY)}
    order by days_overdue desc limit ${limit}`;
}

export async function loadTopRisks(tx: Tx, f: DashboardFilters, limit = 5) {
  return tx<{ id: string; inspectionId: string; title: string; siteName: string; riskLevel: RiskLevel; status: ActionStatus; createdAt: Date; overdue: boolean }[]>`
    select f.id, f.inspection_id, f.title, s.name as site_name, f.risk_level, f.status, f.created_at,
           exists (select 1 from public.corrective_actions ca where ca.finding_id = f.id and ca.status in ('open','in_progress') and ca.due_date < ${tx.unsafe(TODAY)}) as overdue
    from public.findings f join public.inspections i on i.id = f.inspection_id join public.construction_sites s on s.id = f.site_id
    where ${where(tx, f)} and f.assessment = 'negative' and f.risk_level in ('high','critical') and f.status in ('open','in_progress')
    order by case f.risk_level when 'critical' then 0 else 1 end, f.created_at limit ${limit}`;
}

export async function loadTopPositives(tx: Tx, f: DashboardFilters, limit = 5) {
  return tx<{ id: string; inspectionId: string; title: string; siteName: string; categoryName: string | null; createdAt: Date }[]>`
    select f.id, f.inspection_id, f.title, s.name as site_name, c.name as category_name, f.created_at
    from public.findings f join public.inspections i on i.id = f.inspection_id join public.construction_sites s on s.id = f.site_id
    left join public.finding_categories c on c.id = f.category_id
    where ${where(tx, f)} and f.assessment = 'positive' order by f.created_at desc limit ${limit}`;
}

/** Baustellen mit erhöhtem Handlungsbedarf – transparente Punkte: kritisch offen ×4, hoch offen ×3, überfällig ×2, aktive Cluster ×2. */
export async function loadSitesNeedingAction(tx: Tx, f: DashboardFilters, limit = 5) {
  return tx<{ siteId: string; siteName: string; companyName: string; criticalOpen: number; highOpen: number; overdue: number; clusters: number; score: number }[]>`
    with base as (
      select f.site_id,
             count(*) filter (where f.risk_level = 'critical' and f.status in ('open','in_progress') and f.assessment <> 'positive')::int as critical_open,
             count(*) filter (where f.risk_level = 'high' and f.status in ('open','in_progress') and f.assessment <> 'positive')::int as high_open,
             count(*) filter (where exists (select 1 from public.corrective_actions ca where ca.finding_id = f.id and ca.status in ('open','in_progress') and ca.due_date < ${tx.unsafe(TODAY)}))::int as overdue
      from public.findings f join public.inspections i on i.id = f.inspection_id
      where ${where(tx, f)} group by f.site_id
    )
    select b.site_id, s.name as site_name, co.name as company_name, b.critical_open, b.high_open, b.overdue,
           (select count(*)::int from public.recurring_issue_clusters c where c.site_id = b.site_id and c.status = 'active') as clusters,
           (b.critical_open * 4 + b.high_open * 3 + b.overdue * 2 + 2 * (select count(*) from public.recurring_issue_clusters c where c.site_id = b.site_id and c.status = 'active'))::int as score
    from base b join public.construction_sites s on s.id = b.site_id join public.companies co on co.id = s.company_id
    order by score desc limit ${limit}`;
}

export async function loadRecurringTop(tx: Tx, f: DashboardFilters, limit = 8) {
  return tx<{ id: string; scope: string; title: string; insight: string; score: number; memberCount: number; overdueCount: number; siteName: string | null; companyName: string | null }[]>`
    select c.id, c.scope, c.title, c.insight, c.score::float as score, c.member_count, c.overdue_count, s.name as site_name, co.name as company_name
    from public.recurring_issue_clusters c left join public.construction_sites s on s.id = c.site_id left join public.companies co on co.id = c.company_id
    where c.status = 'active'
      ${f.companyId ? tx`and (c.company_id = ${f.companyId} or c.company_id is null)` : tx``}
      ${f.siteId ? tx`and c.site_id = ${f.siteId}` : tx``}
      ${f.categoryId ? tx`and c.category_id = ${f.categoryId}` : tx``}
    order by c.score desc limit ${limit}`;
}

export async function loadFilterOptions(tx: Tx) {
  const [companies, sites, categories, inspectors, roles] = await Promise.all([
    tx<{ id: string; name: string }[]>`select id, name from public.companies where deleted_at is null order by name`,
    tx<{ id: string; name: string }[]>`select id, name from public.construction_sites where deleted_at is null order by name`,
    tx<{ id: string; name: string }[]>`select id, name from public.finding_categories where is_active order by sort_order`,
    tx<{ id: string; name: string }[]>`select distinct p.id, p.full_name as name from public.inspections i join public.user_profiles p on p.id = i.inspector_id order by name`,
    tx<{ role: string }[]>`select distinct responsible_role as role from public.findings where responsible_role is not null order by 1`,
  ]);
  return { companies, sites, categories, inspectors, roles: roles.map((r) => r.role) };
}
