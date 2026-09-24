import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";
import { canSeeGroupAnalytics, hasAnyRole } from "@/lib/domain/permissions";
import { loadFilterOptions } from "@/lib/repositories/dashboard";
import { loadManagementData } from "@/lib/repositories/management";
import { parseDashboardFilters } from "@/lib/utils/dashboard-params";
import { formatDate, formatNumber, formatPercent } from "@/lib/utils/format";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/feedback";
import { ActionStatusBadge, Tag } from "@/components/ui/badges";
import { Table, THead, Th, Td } from "@/components/ui/table";
import { KpiTile } from "@/components/charts/tables";
import { TwoLineChart } from "@/components/charts/charts";
import { FilterBar, FilterInput, FilterSelect } from "@/components/app/filter-bar";

export const metadata: Metadata = { title: "Management-Ansicht" };

export default async function ManagementPage({ searchParams }: PageProps<"/management">) {
  const user = await requireUser();
  if (!canSeeGroupAnalytics(user.permissions) && !hasAnyRole(user.permissions, ["viewer", "admin", "group_ims"])) redirect("/dashboard");
  const sp = await searchParams;
  const f = parseDashboardFilters(sp, 365);
  const { d, options } = await withUser(user.id, async (tx) => ({
    d: await loadManagementData(tx, f),
    options: await loadFilterOptions(tx),
  }));
  const k = d.kpis;
  const qs = new URLSearchParams({ von: f.from, bis: f.to, ...(f.companyId ? { gesellschaft: f.companyId } : {}) }).toString();
  return (
    <>
      <PageHeader
        title="Management-Ansicht"
        description={`Sicherheits- und Qualitätslage · ${formatDate(f.from)} – ${formatDate(f.to)}`}
        actions={
          <>
            <a className={buttonClasses("outline")} href={`/api/export/management?format=pdf&${qs}`}>
              <FileDown className="size-5" aria-hidden /> PDF
            </a>
            <a className={buttonClasses("outline")} href={`/api/export/management?format=xlsx&${qs}`}>
              <FileSpreadsheet className="size-5" aria-hidden /> Excel
            </a>
          </>
        }
      />
      <FilterBar resetHref="/management">
        <FilterInput name="von" label="Von" type="date" value={f.from} />
        <FilterInput name="bis" label="Bis" type="date" value={f.to} />
        <FilterSelect
          name="gesellschaft"
          label="Gesellschaft"
          value={f.companyId}
          options={options.companies.map((c) => ({ value: c.id, label: c.name }))}
        />
      </FilterBar>
      <div className="space-y-6">
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="Gruppenweite Kennzahlen">
          <KpiTile label="Kontrollen" value={k.inspections} />
          <KpiTile label="Feststellungen" value={k.findings} hint={`${k.positive} positiv`} />
          <KpiTile
            label="Abweichungen"
            value={k.negative}
            tone="negative"
            trend={{ delta: k.deviationsCurrent - k.deviationsPrev, goodWhenDown: true }}
          />
          <KpiTile label="Kritische Abweichungen" value={k.criticalDeviations} tone={k.criticalDeviations ? "negative" : "neutral"} />
          <KpiTile label="Überfällige Massnahmen" value={k.overdueActions} tone={k.overdueActions ? "negative" : "positive"} />
          <KpiTile
            label="Erledigungsquote"
            value={formatPercent(k.completionRate)}
            hint={k.avgDaysToCompletion !== null ? `Ø ${formatNumber(k.avgDaysToCompletion, 1)} Tage` : undefined}
          />
        </section>

        <Card>
          <CardHeader title="Gesellschaftsvergleich" description="Kennzahlen je Gesellschaft – keine personenbezogene Rangliste" />
          <CardBody>
            <Table caption="Gesellschaftsvergleich">
              <THead>
                <tr>
                  <Th>Gesellschaft</Th>
                  <Th>Kontrollen</Th>
                  <Th>Feststellungen</Th>
                  <Th>Positiv</Th>
                  <Th>Abweichungen</Th>
                  <Th>Kritisch offen</Th>
                  <Th>Überfällig</Th>
                  <Th>Erledigungsquote</Th>
                  <Th>Ø Tage</Th>
                </tr>
              </THead>
              <tbody>
                {d.companies.map((c) => (
                  <tr key={c.id}>
                    <Td className="font-semibold">
                      <Link className="underline" href={`/dashboard?gesellschaft=${c.id}&von=${f.from}&bis=${f.to}`}>
                        {c.name}
                      </Link>
                    </Td>
                    <Td>{c.inspections}</Td>
                    <Td>{c.findings}</Td>
                    <Td>{c.positive}</Td>
                    <Td>{c.deviations}</Td>
                    <Td className={c.criticalOpen ? "text-negative font-bold" : ""}>{c.criticalOpen}</Td>
                    <Td className={c.overdue ? "text-negative font-bold" : ""}>{c.overdue}</Td>
                    <Td>{formatPercent(c.completionRate)}</Td>
                    <Td>{c.avgDays === null ? "–" : formatNumber(c.avgDays, 1)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardBody>
        </Card>

        <div className="grid gap-5 xl:grid-cols-2">
          <Card>
            <CardHeader title="Entwicklung offener und überfälliger Massnahmen" description="Stand jeweils Monatsende" />
            <CardBody>
              <TwoLineChart data={d.months.map((m) => ({ label: m.label, a: m.open, b: m.overdue }))} aLabel="Offen" bLabel="Überfällig" />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Wiederkehrende systemische Themen" description="Baustellen- bzw. gesellschaftsübergreifend" />
            <CardBody>
              {d.themes.length === 0 ? (
                <p className="text-ink-muted">Keine systemischen Themen erkannt.</p>
              ) : (
                <ul className="space-y-3">
                  {d.themes.map((t) => (
                    <li key={t.title} className="border-line rounded-lg border p-3">
                      <p className="flex flex-wrap items-center gap-2 font-semibold">
                        {t.title}
                        <Tag>Score {t.score}</Tag>
                        <Tag>{t.scope === "group" ? "Gruppe" : "Gesellschaft"}</Tag>
                      </p>
                      <p className="mt-1 text-sm">{t.insight}</p>
                      {t.recommendation && <p className="mt-1 text-sm font-semibold text-amber-900">{t.recommendation}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader title="Kritische Einzelfälle" description="Offene kritische Abweichungen" />
          <CardBody>
            {d.critical.length === 0 ? (
              <p className="text-positive font-semibold">Keine offenen kritischen Abweichungen.</p>
            ) : (
              <Table caption="Kritische Einzelfälle">
                <THead>
                  <tr>
                    <Th>Feststellung</Th>
                    <Th>Baustelle</Th>
                    <Th>Erfasst</Th>
                    <Th>Frist</Th>
                    <Th>Status</Th>
                  </tr>
                </THead>
                <tbody>
                  {d.critical.map((c) => (
                    <tr key={c.id}>
                      <Td>
                        <Link className="font-semibold underline" href={`/kontrollen/${c.inspectionId}/feststellungen/${c.id}`}>
                          {c.title}
                        </Link>
                      </Td>
                      <Td>
                        {c.siteName}
                        <span className="text-ink-muted block text-xs">{c.companyName}</span>
                      </Td>
                      <Td>{formatDate(c.createdAt)}</Td>
                      <Td>{formatDate(c.dueDate)}</Td>
                      <Td>
                        <ActionStatusBadge value={c.status as never} overdue={c.overdue} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
