import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ClipboardCheck, MapPin, Plus, User } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";
import { listInspections } from "@/lib/repositories/inspections";
import { INSPECTION_STATUSES, INSPECTION_STATUS_LABEL, INSPECTION_TYPES, INSPECTION_TYPE_LABEL } from "@/lib/domain/enums";
import { canCreateInspections } from "@/lib/domain/permissions";
import { formatDateTime } from "@/lib/utils/format";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { InspectionStatusBadge, ReportStatusBadge, Tag } from "@/components/ui/badges";
import { dateParam, enumParam, FilterBar, FilterInput, FilterSelect, param, uuidParam } from "@/components/app/filter-bar";

export const metadata: Metadata = { title: "Kontrollen" };

export default async function InspectionsPage({ searchParams }: PageProps<"/kontrollen">) {
  const user = await requireUser();
  const sp = await searchParams;
  const filters = {
    companyId: uuidParam(sp, "gesellschaft"),
    siteId: uuidParam(sp, "baustelle"),
    status: enumParam(sp, "status", INSPECTION_STATUSES),
    type: enumParam(sp, "typ", INSPECTION_TYPES),
    from: dateParam(sp, "von"),
    to: dateParam(sp, "bis"),
    q: param(sp, "q"),
  };
  const { rows, companies, sites } = await withUser(user.id, async (tx) => ({
    rows: await listInspections(tx, filters),
    companies: await tx<{ id: string; name: string }[]>`select id, name from public.companies where deleted_at is null order by name`,
    sites: await tx<{ id: string; name: string }[]>`select id, name from public.construction_sites where deleted_at is null order by name`,
  }));
  const canCreate = canCreateInspections(user.permissions);

  return (
    <>
      <PageHeader
        title="Kontrollen"
        description={`${rows.length} Kontrolle(n)`}
        actions={canCreate && <ButtonLink href="/kontrollen/neu" size="lg"><Plus className="size-5" aria-hidden /> Neue Kontrolle</ButtonLink>}
      />
      <FilterBar resetHref="/kontrollen" defaultOpen={Object.values(filters).some(Boolean)}>
        <FilterInput name="q" label="Suche" value={filters.q} placeholder="Baustelle, Nummer, Bereich" />
        <FilterSelect name="gesellschaft" label="Gesellschaft" value={filters.companyId} options={companies.map((c) => ({ value: c.id, label: c.name }))} />
        <FilterSelect name="baustelle" label="Baustelle" value={filters.siteId} options={sites.map((s) => ({ value: s.id, label: s.name }))} />
        <FilterSelect name="status" label="Status" value={filters.status} options={INSPECTION_STATUSES.map((s) => ({ value: s, label: INSPECTION_STATUS_LABEL[s] }))} />
        <FilterSelect name="typ" label="Kontrolltyp" value={filters.type} options={INSPECTION_TYPES.map((t) => ({ value: t, label: INSPECTION_TYPE_LABEL[t] }))} />
        <FilterInput name="von" label="Von" type="date" value={filters.from} />
        <FilterInput name="bis" label="Bis" type="date" value={filters.to} />
      </FilterBar>

      {rows.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="size-12" aria-hidden />}
          title="Keine Kontrollen gefunden"
          description={canCreate ? "Starten Sie eine neue Baustellenkontrolle oder passen Sie die Filter an." : "Für Ihre Filter bzw. Berechtigung sind keine Kontrollen vorhanden."}
          action={canCreate && <ButtonLink href="/kontrollen/neu"><Plus className="size-5" aria-hidden /> Neue Kontrolle</ButtonLink>}
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {rows.map((r) => (
            <li key={r.id} className="min-w-0">
              <Link href={`/kontrollen/${r.id}`} className="block rounded-[var(--radius-card)] border border-line bg-white p-4 shadow-[var(--shadow-card)] hover:border-line-strong focus-visible:border-info">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold">{r.siteName}</p>
                    <p className="text-sm text-ink-muted">{r.siteNumber} · {r.companyName}</p>
                  </div>
                  <InspectionStatusBadge value={r.status} />
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
                  <span className="flex items-center gap-1"><CalendarDays className="size-4" aria-hidden />{formatDateTime(r.inspectedAt)}</span>
                  <span className="flex items-center gap-1"><MapPin className="size-4" aria-hidden />{INSPECTION_TYPE_LABEL[r.inspectionType]}</span>
                  <span className="flex items-center gap-1"><User className="size-4" aria-hidden />{r.inspectorName}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Tag className="text-positive">{r.positiveCount} positiv</Tag>
                  <Tag className="text-negative">{r.negativeCount} Abweichung(en)</Tag>
                  <Tag className="text-improve">{r.improvementCount} Verbesserung(en)</Tag>
                  {r.criticalCount > 0 && <Tag className="border-red-400 bg-red-50 text-red-800">{r.criticalCount} kritisch</Tag>}
                  {r.reportStatus && <ReportStatusBadge value={r.reportStatus} />}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
