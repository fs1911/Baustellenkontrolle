import "server-only";
import { withService, type Tx } from "@/lib/db/client";
import { buildClusters, type Cluster } from "@/lib/domain/recurrence";
import { loadAnalysisFindings } from "@/lib/repositories/analysis";
import { loadSettings } from "@/lib/repositories/settings";

/**
 * Berechnet wiederkehrende Abweichungen gruppenweit und speichert sie als nachvollziehbaren Snapshot
 * (recurring_issue_clusters). Sichtbarkeit wird über RLS nach Baustelle/Gesellschaft/Gruppe gesteuert.
 * Aufruf: nach Abschluss einer Kontrolle, per "Neu berechnen" oder zeitgesteuert (/api/jobs/recurrence).
 */
export async function recomputeRecurringClusters(now = new Date()): Promise<{ clusters: number }> {
  return withService(async (tx) => {
    const settings = await loadSettings(tx);
    const config = settings["recurrence.scoring"];
    const findings = await loadAnalysisFindings(tx, config.windowDays + 1);
    const clusters = buildClusters(findings, now, config);
    await persistClusters(tx, clusters, config.windowDays);
    return { clusters: clusters.length };
  });
}

async function persistClusters(tx: Tx, clusters: Cluster[], windowDays: number): Promise<void> {
  const keys = clusters.map((c) => c.key);
  await tx`delete from public.recurring_issue_clusters where not (cluster_key = any(${keys}::text[]))`;
  for (const c of clusters) {
    const [row] = await tx<{ id: string }[]>`
      insert into public.recurring_issue_clusters (
        cluster_key, scope, company_id, site_id, category_id, subcategory_id, title, insight, recommendation,
        score, score_breakdown, member_count, open_count, overdue_count, first_seen_at, last_seen_at, window_days, computed_at)
      values (${c.key}, ${c.scope}, ${c.companyId}, ${c.siteId}, ${c.categoryId}, ${c.subcategoryId}, ${c.title}, ${c.insight},
              ${c.recommendation}, ${c.score}, ${tx.json(c.items.map((i) => ({ ...i })))}, ${c.memberIds.length}, ${c.openCount},
              ${c.overdueCount}, ${c.firstSeenAt}, ${c.lastSeenAt}, ${windowDays}, now())
      on conflict (cluster_key) do update set
        title = excluded.title, insight = excluded.insight, recommendation = excluded.recommendation, score = excluded.score,
        score_breakdown = excluded.score_breakdown, member_count = excluded.member_count, open_count = excluded.open_count,
        overdue_count = excluded.overdue_count, first_seen_at = excluded.first_seen_at, last_seen_at = excluded.last_seen_at,
        window_days = excluded.window_days, computed_at = now(),
        status = case when public.recurring_issue_clusters.member_count < excluded.member_count
                      then 'active'::public.cluster_status else public.recurring_issue_clusters.status end
      returning id`;
    await tx`delete from public.recurring_issue_cluster_members where cluster_id = ${row.id}`;
    const members = c.memberIds.map((id) => ({ cluster_id: row.id, finding_id: id, similarity: c.memberSimilarity[id] ?? null }));
    if (members.length) await tx`insert into public.recurring_issue_cluster_members ${tx(members)}`;
  }
}
