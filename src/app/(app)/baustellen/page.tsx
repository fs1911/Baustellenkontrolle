import type { Metadata } from "next";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";
import { canCreateSite, canSeeAnalytics } from "@/lib/domain/permissions";
import { formatDate } from "@/lib/utils/format";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { Tag } from "@/components/ui/badges";
import { NewSiteButton } from "@/components/app/new-site-button";

export const metadata: Metadata = { title: "Baustellen und Projekte" };

export default async function SitesPage() {
  const user = await requireUser();
  const { sites, companies } = await withUser(user.id, async (tx) => ({
    sites: await tx<{ id: string; name: string; siteNumber: string; companyName: string; projectName: string | null; street: string | null; postalCode: string | null; city: string | null; isActive: boolean; inspections: number; lastInspection: Date | null; openActions: number; overdue: number; findings: number }[]>`
      select s.id, s.name, s.site_number, c.name as company_name, p.name as project_name, s.street, s.postal_code, s.city, s.is_active,
             (select count(*)::int from public.inspections i where i.site_id = s.id and i.deleted_at is null) as inspections,
             (select max(i.inspected_at) from public.inspections i where i.site_id = s.id and i.deleted_at is null) as last_inspection,
             (select count(*)::int from public.findings f where f.site_id = s.id and f.deleted_at is null) as findings,
             (select count(*)::int from public.corrective_actions a where a.site_id = s.id and a.status in ('open','in_progress')) as open_actions,
             (select count(*)::int from public.corrective_actions a where a.site_id = s.id and a.status in ('open','in_progress') and a.due_date < (now() at time zone 'Europe/Zurich')::date) as overdue
      from public.construction_sites s join public.companies c on c.id = s.company_id left join public.projects p on p.id = s.project_id
      where s.deleted_at is null order by c.name, s.name`,
    companies: await tx<{ id: string; name: string }[]>`select id, name from public.companies where deleted_at is null order by name`,
  }));
  const creatable = companies.filter((c) => canCreateSite(user.permissions, c.id));
  const analytics = canSeeAnalytics(user.permissions);
  return (
    <>
      <PageHeader title="Baustellen und Projekte" description={`${sites.length} Baustelle(n) gemäss Ihrer Berechtigung`} actions={<NewSiteButton companies={creatable} />} />
      {sites.length === 0 ? (
        <EmptyState icon={<Building2 className="size-12" aria-hidden />} title="Keine Baustellen zugeordnet" description="Bitte wenden Sie sich an die Administration für eine Zuordnung." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sites.map((s) => (
            <Card key={s.id}>
              <CardBody className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><p className="text-lg font-semibold">{s.name}</p><p className="text-sm text-ink-muted">{s.siteNumber} · {s.companyName}</p><p className="text-sm text-ink-muted">{[s.street, [s.postalCode, s.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</p></div>
                  {!s.isActive && <Tag>Abgeschlossen</Tag>}
                </div>
                <dl className="grid grid-cols-4 gap-2 text-center">
                  {[["Kontrollen", s.inspections], ["Feststellungen", s.findings], ["Offene Massn.", s.openActions], ["Überfällig", s.overdue]].map(([k, v]) => (
                    <div key={k as string} className={`rounded-lg border p-2 ${k === "Überfällig" && (v as number) > 0 ? "border-red-300 bg-red-50" : "border-line"}`}><dt className="text-xs text-ink-muted">{k}</dt><dd className="text-xl font-bold tabular-nums">{v}</dd></div>
                  ))}
                </dl>
                <p className="text-sm text-ink-muted">Letzte Kontrolle: {formatDate(s.lastInspection)}</p>
                <div className="flex flex-wrap gap-3 text-sm font-semibold">
                  <Link className="text-info underline" href={`/kontrollen?baustelle=${s.id}`}>Kontrollen</Link>
                  <Link className="text-info underline" href={`/massnahmen?baustelle=${s.id}`}>Massnahmen</Link>
                  {analytics && <Link className="text-info underline" href={`/dashboard?baustelle=${s.id}`}>Baustellen-Dashboard</Link>}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
