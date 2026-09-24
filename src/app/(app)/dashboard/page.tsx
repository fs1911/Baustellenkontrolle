import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Repeat, ThumbsUp } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";
import { canSeeAnalytics } from "@/lib/domain/permissions";
import {
  loadCategoryCounts, loadCompanyAssessment, loadFilterOptions, loadHeatmap, loadKpis, loadOverdue, loadRecurringTop, loadRiskMatrix,
  loadSitesNeedingAction, loadSubcategoryCounts, loadTopPositives, loadTopRisks, loadWeekly,
} from "@/lib/repositories/dashboard";
import { findingsLink, parseDashboardFilters } from "@/lib/utils/dashboard-params";
import { formatDate, formatNumber, formatPercent } from "@/lib/utils/format";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert, EmptyState, PageHeader } from "@/components/ui/feedback";
import { ActionStatusBadge, RiskBadge, Tag } from "@/components/ui/badges";
import { Table, THead, Th, Td } from "@/components/ui/table";
import { CompanyAssessmentChart, HorizontalBarChart, WeeklyAssessmentChart } from "@/components/charts/charts";
import { Heatmap, KpiTile, RiskMatrix } from "@/components/charts/tables";
import { DashboardFilterBar } from "@/components/app/dashboard-filters";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const user = await requireUser();
  if (!canSeeAnalytics(user.permissions)) redirect("/massnahmen");
  const sp = await searchParams;
  const f = parseDashboardFilters(sp);
  const d = await withUser(user.id, async (tx) => {
    const [kpis, weekly, categories, subcategories, companies, heatmap, matrix, overdue, recurring, topRisks, positives, sites, options] = await Promise.all([
      loadKpis(tx, f), loadWeekly(tx, f), loadCategoryCounts(tx, f), loadSubcategoryCounts(tx, f), loadCompanyAssessment(tx, f),
      loadHeatmap(tx, f), loadRiskMatrix(tx, f), loadOverdue(tx, f), loadRecurringTop(tx, f), loadTopRisks(tx, f), loadTopPositives(tx, f),
      loadSitesNeedingAction(tx, f), loadFilterOptions(tx),
    ]);
    return { kpis, weekly, categories, subcategories, companies, heatmap, matrix, overdue, recurring, topRisks, positives, sites, options };
  });
  const k = d.kpis;
  const link = (extra: Record<string, string | undefined> = {}) => findingsLink(f, extra);

  return (
    <>
      <PageHeader title="Dashboard" description={`Zeitraum ${formatDate(f.from)} – ${formatDate(f.to)} · Daten gemäss Ihrer Berechtigung`} />
      {sp.fehler === "keine-berechtigung" && <Alert tone="warning" className="mb-4">Für die angeforderte Seite fehlt Ihnen die Berechtigung.</Alert>}
      <DashboardFilterBar f={f} options={d.options} resetHref="/dashboard" />

      {k.findings === 0 && k.inspections === 0 ? (
        <EmptyState title="Keine Daten im gewählten Zeitraum" description="Passen Sie die Filter an oder erfassen Sie eine Kontrolle." />
      ) : (
        <div className="space-y-6">
          <section aria-label="Kennzahlen" className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            <KpiTile label="Kontrollen" value={k.inspections} href="/kontrollen" />
            <KpiTile label="Feststellungen" value={k.findings} href={link()} />
            <KpiTile label="Positive Feststellungen" value={k.positive} tone="positive" href={link({ beurteilung: "positive" })} />
            <KpiTile label="Abweichungen" value={k.negative} tone="negative" href={link({ beurteilung: "negative" })} trend={{ delta: k.deviationsCurrent - k.deviationsPrev, goodWhenDown: true }} />
            <KpiTile label="Verbesserungsmöglichkeiten" value={k.improvement} tone="warning" href={link({ beurteilung: "improvement" })} />
            <KpiTile label="Kritische Abweichungen" value={k.criticalDeviations} tone={k.criticalDeviations ? "negative" : "neutral"} href={link({ beurteilung: "negative", risiko: "critical" })} />
            <KpiTile label="Offene Massnahmen" value={k.openActions} href="/massnahmen?status=offen" />
            <KpiTile label="Überfällige Massnahmen" value={k.overdueActions} tone={k.overdueActions ? "negative" : "positive"} href="/massnahmen?ueberfaellig=1" />
            <KpiTile label="Erledigungsquote" value={formatPercent(k.completionRate)} hint="Behoben, verifiziert oder geschlossen" />
            <KpiTile label="Ø Tage bis Erledigung" value={k.avgDaysToCompletion === null ? "–" : formatNumber(k.avgDaysToCompletion, 1)} />
            <KpiTile label="Wiederkehrende Abweichungen" value={k.recurringClusters} tone={k.recurringClusters ? "warning" : "neutral"} href="/wiederkehrend" hint="Aktive Cluster" />
            <KpiTile label="Trend Abweichungen" value={`${k.deviationsCurrent}`} hint={`Vorperiode: ${k.deviationsPrev}`} trend={{ delta: k.deviationsCurrent - k.deviationsPrev, goodWhenDown: true }} />
          </section>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader title="Feststellungen pro Woche" description="Nach Beurteilung – Balken anklicken für Details" />
              <CardBody><WeeklyAssessmentChart data={d.weekly} drillBase={link().replace(/&?von=[^&]*/, "")} /></CardBody>
            </Card>
            <Card>
              <CardHeader title="Häufigste Kategorien" description="Abweichungen und Verbesserungsmöglichkeiten" />
              <CardBody>{d.categories.length ? <HorizontalBarChart data={d.categories} label="Häufigste Kategorien" hrefs={Object.fromEntries(d.categories.map((c) => [c.id, link({ kategorie: c.id })]))} /> : <p className="text-ink-muted">Keine Daten.</p>}</CardBody>
            </Card>
            <Card>
              <CardHeader title="Beurteilungen nach Gesellschaft" />
              <CardBody>{d.companies.length ? <CompanyAssessmentChart data={d.companies} hrefs={Object.fromEntries(d.companies.map((c) => [c.id, link({ gesellschaft: c.id })]))} /> : <p className="text-ink-muted">Keine Daten.</p>}</CardBody>
            </Card>
            <Card>
              <CardHeader title="Häufigste Unterkategorien" />
              <CardBody>
                <ol className="space-y-2">
                  {d.subcategories.map((s, i) => (
                    <li key={s.id}><Link href={link({ unterkategorie: s.id })} className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-line px-3 hover:bg-slate-50">
                      <span><span className="text-ink-muted">{i + 1}.</span> {s.name}<span className="block text-xs text-ink-muted">{s.categoryName}</span></span><span className="font-bold tabular-nums">{s.n}</span>
                    </Link></li>
                  ))}
                </ol>
              </CardBody>
            </Card>
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader title="Heatmap Kategorie × Baustelle" />
              <CardBody><Heatmap cells={d.heatmap} drill={(c, s) => link({ kategorie: c, baustelle: s })} /></CardBody>
            </Card>
            <Card>
              <CardHeader title="Risikomatrix" description="Risikostufe × Bearbeitungsstand" />
              <CardBody><RiskMatrix rows={d.matrix} drill={(r, st) => link({ risiko: r, status: st })} /></CardBody>
            </Card>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader title="Top-Risiken" description="Offene hohe und kritische Abweichungen" />
              <CardBody>
                {d.topRisks.length === 0 ? <p className="text-ink-muted">Keine offenen hohen oder kritischen Abweichungen.</p> : (
                  <ul className="space-y-2">{d.topRisks.map((r) => (
                    <li key={r.id}><Link href={`/kontrollen/${r.inspectionId}/feststellungen/${r.id}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-2 hover:bg-slate-50">
                      <RiskBadge value={r.riskLevel} /><span className="min-w-0 flex-1 font-semibold">{r.title}<span className="block text-xs font-normal text-ink-muted">{r.siteName} · seit {formatDate(r.createdAt)}</span></span><ActionStatusBadge value={r.status} overdue={r.overdue} />
                    </Link></li>))}
                  </ul>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Baustellen mit erhöhtem Handlungsbedarf" description="Punkte: kritisch offen ×4, hoch offen ×3, überfällig ×2, aktive Cluster ×2" />
              <CardBody>
                <Table caption="Baustellen mit Handlungsbedarf">
                  <THead><tr><Th>Baustelle</Th><Th>Kritisch</Th><Th>Hoch</Th><Th>Überfällig</Th><Th>Cluster</Th><Th>Punkte</Th></tr></THead>
                  <tbody>{d.sites.filter((s) => s.score > 0).map((s) => (
                    <tr key={s.siteId}><Td><Link className="font-semibold underline" href={`/dashboard?baustelle=${s.siteId}&von=${f.from}&bis=${f.to}`}>{s.siteName}</Link><span className="block text-xs text-ink-muted">{s.companyName}</span></Td>
                      <Td>{s.criticalOpen}</Td><Td>{s.highOpen}</Td><Td>{s.overdue}</Td><Td>{s.clusters}</Td><Td className="font-bold">{s.score}</Td></tr>))}
                  </tbody>
                </Table>
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader title="Überfällige Massnahmen" actions={<Link href="/massnahmen?ueberfaellig=1" className="font-semibold text-info underline">Alle anzeigen</Link>} />
            <CardBody>
              {d.overdue.length === 0 ? <p className="text-positive font-semibold">Keine überfälligen Massnahmen.</p> : (
                <Table caption="Überfällige Massnahmen">
                  <THead><tr><Th>Massnahme</Th><Th>Baustelle</Th><Th>Verantwortlich</Th><Th>Frist</Th><Th>Überfällig</Th><Th>Risiko</Th></tr></THead>
                  <tbody>{d.overdue.map((o) => (
                    <tr key={o.actionId}><Td><Link href={`/kontrollen/${o.inspectionId}/feststellungen/${o.findingId}`} className="font-semibold underline">{o.title}</Link><span className="block text-xs text-ink-muted">{o.description}</span></Td>
                      <Td>{o.siteName}</Td><Td>{o.responsible ?? "–"}</Td><Td>{formatDate(o.dueDate)}</Td><Td className="font-bold text-negative">{o.daysOverdue} Tage</Td><Td><RiskBadge value={o.riskLevel} /></Td></tr>))}
                  </tbody>
                </Table>
              )}
            </CardBody>
          </Card>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader title={<span className="flex items-center gap-2"><Repeat className="size-5" aria-hidden /> Wiederkehrende Abweichungen</span>} actions={<Link href="/wiederkehrend" className="font-semibold text-info underline">Details und Kriterien</Link>} />
              <CardBody>
                {d.recurring.length === 0 ? <p className="text-ink-muted">Keine aktiven Muster erkannt.</p> : (
                  <Table caption="Wiederkehrende Abweichungen mit Trend-Score">
                    <THead><tr><Th>Thema</Th><Th>Ebene</Th><Th>Anzahl</Th><Th>Score</Th></tr></THead>
                    <tbody>{d.recurring.map((r) => (
                      <tr key={r.id}><Td><Link href={`/wiederkehrend#${r.id}`} className="font-semibold underline">{r.title}</Link><span className="block text-xs text-ink-muted">{r.siteName ?? r.companyName ?? "Gruppe"}</span></Td>
                        <Td>{r.scope === "site" ? "Baustelle" : r.scope === "company" ? "Gesellschaft" : "Gruppe"}</Td><Td>{r.memberCount}</Td><Td className="font-bold">{r.score}</Td></tr>))}
                    </tbody>
                  </Table>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title={<span className="flex items-center gap-2"><ThumbsUp className="size-5 text-positive" aria-hidden /> Positive Feststellungen (Top 5)</span>} description="Gute Praxis sichtbar machen" />
              <CardBody>
                {d.positives.length === 0 ? <p className="text-ink-muted">Keine positiven Feststellungen im Zeitraum.</p> : (
                  <ul className="space-y-2">{d.positives.map((p) => (
                    <li key={p.id}><Link href={`/kontrollen/${p.inspectionId}/feststellungen/${p.id}`} className="block rounded-lg border border-green-200 bg-positive-soft/40 p-2 hover:bg-positive-soft">
                      <span className="font-semibold">{p.title}</span><span className="block text-xs text-ink-muted">{p.siteName} · {formatDate(p.createdAt)}{p.categoryName ? ` · ${p.categoryName}` : ""}</span>
                    </Link></li>))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>
          <p className="text-xs text-ink-muted"><Tag>Hinweis</Tag> Auswertungen dienen der Prävention und Verbesserung. Es werden keine personenbezogenen Rankings erstellt.</p>
        </div>
      )}
    </>
  );
}
