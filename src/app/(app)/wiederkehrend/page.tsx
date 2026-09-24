import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Repeat } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";
import { canSeeAnalytics } from "@/lib/domain/permissions";
import { buildInsights, type ScoreItem } from "@/lib/domain/recurrence";
import { loadAnalysisFindings } from "@/lib/repositories/analysis";
import { loadSettings } from "@/lib/repositories/settings";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert, EmptyState, PageHeader } from "@/components/ui/feedback";
import { Tag } from "@/components/ui/badges";
import { ClusterStatusButtons, RecomputeButton } from "@/components/app/cluster-controls";

export const metadata: Metadata = { title: "Wiederkehrende Abweichungen" };

const SCOPE = { site: "Baustelle", company: "Gesellschaft (baustellenübergreifend)", group: "Gruppe (gesellschaftsübergreifend)" } as const;
const STATUS = { active: "Aktiv", acknowledged: "In Bearbeitung", resolved: "Gelöst" } as const;

export default async function RecurringPage() {
  const user = await requireUser();
  if (!canSeeAnalytics(user.permissions)) redirect("/massnahmen");
  const d = await withUser(user.id, async (tx) => {
    const settings = await loadSettings(tx);
    const clusters = await tx<{ id: string; scope: keyof typeof SCOPE; title: string; insight: string; recommendation: string | null; score: number; scoreBreakdown: ScoreItem[]; memberCount: number; openCount: number; overdueCount: number; firstSeenAt: Date; lastSeenAt: Date; windowDays: number; status: keyof typeof STATUS; computedAt: Date }[]>`
      select id, scope, title, insight, recommendation, score::float as score, score_breakdown, member_count, open_count, overdue_count,
             first_seen_at, last_seen_at, window_days, status, computed_at
      from public.recurring_issue_clusters order by status = 'resolved', score desc`;
    const members = await tx<{ clusterId: string; findingId: string; inspectionId: string; title: string; siteName: string; createdAt: Date; similarity: number | null }[]>`
      select m.cluster_id, f.id as finding_id, f.inspection_id, f.title, s.name as site_name, f.created_at, m.similarity::float as similarity
      from public.recurring_issue_cluster_members m join public.findings f on f.id = m.finding_id join public.construction_sites s on s.id = f.site_id
      order by f.created_at desc`;
    const insights = buildInsights(await loadAnalysisFindings(tx, settings["recurrence.scoring"].windowDays * 2), new Date(), settings["recurrence.scoring"]);
    return { clusters, members, insights, config: settings["recurrence.scoring"] };
  });
  const c = d.config;
  return (
    <>
      <PageHeader title="Wiederkehrende Abweichungen" description="Datenbasierte Unterstützung zur Prävention und Verbesserung – keine Bewertung von Personen."
        actions={user.permissions.is_catalog_editor && <RecomputeButton />} />
      <Card className="mb-5">
        <CardHeader title="So wird der Trend-Score berechnet" description={`Betrachtungszeitraum ${c.windowDays} Tage · konfigurierbar unter Verwaltung → Einstellungen`} />
        <CardBody>
          <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <li>+{c.sameSubcategory} gleiche Unterkategorie im Zeitraum</li>
            <li>+{c.similarText} ähnliche Beschreibung (Textähnlichkeit ≥ {Math.round(c.similarityThreshold * 100)} %)</li>
            <li>+{c.sameSite} gleiche Baustelle</li>
            <li>+{c.sameResponsibleRole} wiederkehrende Verantwortungsrolle (Rolle, nicht Person)</li>
            <li>+{c.highRisk} hohe oder kritische Risikostufe</li>
            <li>+{c.overdueAction} überfällige Massnahme</li>
            <li>+{c.perAdditional} je weitere ähnliche Feststellung (max. {c.maxAdditional})</li>
            {c.sameTrade > 0 && <li>+{c.sameTrade} gleicher Bereich / Gewerk</li>}
          </ul>
          <p className="mt-2 text-sm text-ink-muted">Priorität: hoch ab {c.highPriorityScore} Punkten, mittel ab {c.mediumPriorityScore} Punkten.</p>
        </CardBody>
      </Card>

      {d.insights.length > 0 && (
        <div className="mb-5 space-y-3">
          <h2 className="text-xl font-bold">Hinweise</h2>
          {d.insights.map((i) => (
            <Alert key={i.title} tone="warning" title={i.title}>
              <p>{i.text}</p>
              <p className="mt-1 font-semibold">{i.recommendation}</p>
              <p className="mt-1 text-xs">Kriterien: {i.criteria.join(" · ")}</p>
            </Alert>
          ))}
        </div>
      )}

      {d.clusters.length === 0 ? (
        <EmptyState icon={<Repeat className="size-12" aria-hidden />} title="Keine wiederkehrenden Muster erkannt" description="Sobald sich Abweichungen wiederholen, erscheinen sie hier mit nachvollziehbaren Kriterien." />
      ) : (
        <div className="space-y-4">
          {d.clusters.map((cl) => {
            const members = d.members.filter((m) => m.clusterId === cl.id);
            return (
              <Card key={cl.id} id={cl.id} className={cl.status === "resolved" ? "opacity-70" : ""}>
                <CardHeader title={cl.title} description={<span className="flex flex-wrap gap-1.5"><Tag>{SCOPE[cl.scope]}</Tag><Tag>{STATUS[cl.status]}</Tag><Tag>{cl.memberCount} Feststellungen</Tag>{cl.overdueCount > 0 && <Tag className="text-negative">{cl.overdueCount} überfällig</Tag>}</span>}
                  actions={<div className="text-right"><p className="text-3xl font-bold tabular-nums">{cl.score}</p><p className="text-xs text-ink-muted">Trend-Score</p></div>} />
                <CardBody className="grid gap-5 lg:grid-cols-2">
                  <div className="space-y-3">
                    <p className="font-medium">{cl.insight}</p>
                    {cl.recommendation && <p className="rounded-lg bg-improve-soft p-3 text-sm font-semibold text-amber-950">{cl.recommendation}</p>}
                    <p className="text-xs text-ink-muted">Zeitraum der Feststellungen: {formatDate(cl.firstSeenAt)} – {formatDate(cl.lastSeenAt)} · berechnet {formatDateTime(cl.computedAt)}</p>
                    {user.permissions.is_catalog_editor && <ClusterStatusButtons id={cl.id} status={cl.status} />}
                  </div>
                  <div className="space-y-3">
                    <table className="w-full text-sm">
                      <caption className="mb-1 text-left font-semibold">Verwendete Kriterien</caption>
                      <tbody>
                        {cl.scoreBreakdown.map((i) => (
                          <tr key={i.criterion} className="border-t border-line"><td className="py-1.5 pr-2">{i.label}<span className="block text-xs text-ink-muted">{i.detail}</span></td><td className="py-1.5 text-right font-bold">{i.points > 0 ? `+${i.points}` : "–"}</td></tr>
                        ))}
                      </tbody>
                    </table>
                    <details>
                      <summary className="min-h-10 cursor-pointer text-sm font-semibold text-info">Zugehörige Feststellungen ({members.length})</summary>
                      <ul className="mt-2 space-y-1 text-sm">
                        {members.map((m) => (
                          <li key={m.findingId}><Link className="underline" href={`/kontrollen/${m.inspectionId}/feststellungen/${m.findingId}`}>{m.title}</Link> <span className="text-ink-muted">· {m.siteName} · {formatDate(m.createdAt)}{m.similarity !== null ? ` · Ähnlichkeit ${Math.round(m.similarity * 100)} %` : ""}</span></li>
                        ))}
                      </ul>
                    </details>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
