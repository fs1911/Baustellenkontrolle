import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";
import { searchFindings } from "@/lib/repositories/findings";
import { loadFilterOptions } from "@/lib/repositories/dashboard";
import { ACTION_STATUSES, ACTION_STATUS_LABEL, ASSESSMENTS, ASSESSMENT_LABEL, RISK_LEVELS, RISK_LABEL } from "@/lib/domain/enums";
import { formatDate } from "@/lib/utils/format";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { ActionStatusBadge, AssessmentBadge, RiskBadge } from "@/components/ui/badges";
import { Table, THead, Th, Td } from "@/components/ui/table";
import { dateParam, enumParam, FilterBar, FilterInput, FilterSelect, param, uuidParam } from "@/components/app/filter-bar";

export const metadata: Metadata = { title: "Feststellungen" };

export default async function FindingsPage({ searchParams }: PageProps<"/feststellungen">) {
  const user = await requireUser();
  const sp = await searchParams;
  const f = {
    companyId: uuidParam(sp, "gesellschaft"), siteId: uuidParam(sp, "baustelle"), categoryId: uuidParam(sp, "kategorie"),
    subcategoryId: uuidParam(sp, "unterkategorie"), assessment: enumParam(sp, "beurteilung", ASSESSMENTS), riskLevel: enumParam(sp, "risiko", RISK_LEVELS),
    status: enumParam(sp, "status", ACTION_STATUSES), responsibleRole: param(sp, "rolle"), inspectorId: uuidParam(sp, "kontrolleur"),
    from: dateParam(sp, "von"), to: dateParam(sp, "bis"), q: param(sp, "q"), overdue: param(sp, "ueberfaellig") === "1",
    ids: param(sp, "ids")?.split(",").filter((x) => /^[0-9a-f-]{36}$/i.test(x)),
  };
  const { rows, options } = await withUser(user.id, async (tx) => ({ rows: await searchFindings(tx, f), options: await loadFilterOptions(tx) }));
  return (
    <>
      <PageHeader title="Feststellungen" description={`${rows.length} Treffer${rows.length === 300 ? " (max. 300 angezeigt)" : ""}`} />
      <FilterBar resetHref="/feststellungen" defaultOpen={Object.values(f).some((v) => (Array.isArray(v) ? v.length : !!v))}>
        <FilterInput name="q" label="Volltextsuche" value={f.q} placeholder="z. B. Seitenschutz" />
        <FilterSelect name="beurteilung" label="Beurteilung" value={f.assessment} options={ASSESSMENTS.map((a) => ({ value: a, label: ASSESSMENT_LABEL[a] }))} />
        <FilterSelect name="risiko" label="Risikostufe" value={f.riskLevel} options={RISK_LEVELS.map((r) => ({ value: r, label: RISK_LABEL[r] }))} />
        <FilterSelect name="status" label="Status" value={f.status} options={ACTION_STATUSES.map((s) => ({ value: s, label: ACTION_STATUS_LABEL[s] }))} />
        <FilterSelect name="gesellschaft" label="Gesellschaft" value={f.companyId} options={options.companies.map((c) => ({ value: c.id, label: c.name }))} />
        <FilterSelect name="baustelle" label="Baustelle" value={f.siteId} options={options.sites.map((s) => ({ value: s.id, label: s.name }))} />
        <FilterSelect name="kategorie" label="Kategorie" value={f.categoryId} options={options.categories.map((c) => ({ value: c.id, label: c.name }))} />
        <FilterSelect name="rolle" label="Verantwortliche Rolle" value={f.responsibleRole} options={options.roles.map((r) => ({ value: r, label: r }))} />
        <FilterInput name="von" label="Von" type="date" value={f.from} />
        <FilterInput name="bis" label="Bis" type="date" value={f.to} />
        <FilterSelect name="ueberfaellig" label="Nur überfällige" value={f.overdue ? "1" : undefined} options={[{ value: "1", label: "Ja" }]} />
      </FilterBar>
      {rows.length === 0 ? (
        <EmptyState icon={<Search className="size-12" aria-hidden />} title="Keine Feststellungen gefunden" description="Passen Sie die Filter an." />
      ) : (
        <Table caption="Feststellungen">
          <THead><tr><Th>Feststellung</Th><Th>Beurteilung</Th><Th>Risiko</Th><Th>Status</Th><Th>Kategorie</Th><Th>Baustelle</Th><Th>Datum</Th></tr></THead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <Td><Link href={`/kontrollen/${r.inspectionId}/feststellungen/${r.id}`} className="font-semibold underline">{r.title}</Link></Td>
                <Td><AssessmentBadge value={r.assessment} /></Td>
                <Td><RiskBadge value={r.riskLevel} /></Td>
                <Td><ActionStatusBadge value={r.status} overdue={r.overdue} />{r.dueDate && <span className="block text-xs text-ink-muted">Frist {formatDate(r.dueDate)}</span>}</Td>
                <Td>{r.categoryName ?? "–"}{r.subcategoryName && <span className="block text-xs text-ink-muted">{r.subcategoryName}</span>}</Td>
                <Td>{r.siteName}<span className="block text-xs text-ink-muted">{r.companyName}</span></Td>
                <Td className="whitespace-nowrap">{formatDate(r.createdAt)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
