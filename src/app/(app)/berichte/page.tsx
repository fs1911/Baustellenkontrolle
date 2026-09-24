import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";
import { REPORT_STATUSES, REPORT_STATUS_LABEL, type ReportStatus } from "@/lib/domain/enums";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { ReportStatusBadge } from "@/components/ui/badges";
import { Table, THead, Th, Td } from "@/components/ui/table";
import { enumParam, FilterBar, FilterSelect } from "@/components/app/filter-bar";

export const metadata: Metadata = { title: "Berichtshistorie" };

export default async function ReportsPage({ searchParams }: PageProps<"/berichte">) {
  const user = await requireUser();
  const status = enumParam(await searchParams, "status", REPORT_STATUSES);
  const rows = await withUser(
    user.id,
    (tx) => tx<
      {
        id: string;
        inspectionId: string;
        reportNumber: string;
        status: ReportStatus;
        siteName: string;
        companyName: string;
        inspectedAt: Date;
        releasedAt: Date | null;
        sentAt: Date | null;
        versions: number;
        finalVersionId: string | null;
        deliveries: number;
        failed: number;
      }[]
    >`
    select r.id, r.inspection_id, r.report_number, r.status, s.name as site_name, c.name as company_name, i.inspected_at, r.released_at, r.sent_at,
           (select count(*)::int from public.report_versions v where v.report_id = r.id) as versions,
           (select v.id from public.report_versions v where v.report_id = r.id and v.is_final order by v.version_no desc limit 1) as final_version_id,
           (select count(*)::int from public.email_deliveries d where d.report_id = r.id) as deliveries,
           (select count(*)::int from public.email_deliveries d where d.report_id = r.id and d.status = 'failed') as failed
    from public.generated_reports r join public.inspections i on i.id = r.inspection_id and i.deleted_at is null
    join public.construction_sites s on s.id = r.site_id join public.companies c on c.id = r.company_id
    ${status ? tx`where r.status = ${status}` : tx``}
    order by coalesce(r.sent_at, r.released_at, r.created_at) desc limit 300`,
  );
  return (
    <>
      <PageHeader title="Berichtshistorie" description={`${rows.length} Bericht(e)`} />
      <FilterBar resetHref="/berichte" defaultOpen={!!status}>
        <FilterSelect
          name="status"
          label="Status"
          value={status}
          options={REPORT_STATUSES.map((s) => ({ value: s, label: REPORT_STATUS_LABEL[s] }))}
        />
      </FilterBar>
      {rows.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-12" aria-hidden />}
          title="Noch keine Berichte"
          description="Berichte entstehen aus einer Kontrolle über «Bericht»."
        />
      ) : (
        <Table caption="Berichtshistorie">
          <THead>
            <tr>
              <Th>Bericht-ID</Th>
              <Th>Baustelle</Th>
              <Th>Kontrolle</Th>
              <Th>Status</Th>
              <Th>Versionen</Th>
              <Th>Versand</Th>
              <Th>PDF</Th>
            </tr>
          </THead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <Td>
                  <Link href={`/kontrollen/${r.inspectionId}/bericht`} className="font-semibold underline">
                    {r.reportNumber}
                  </Link>
                </Td>
                <Td>
                  {r.siteName}
                  <span className="text-ink-muted block text-xs">{r.companyName}</span>
                </Td>
                <Td>{formatDate(r.inspectedAt)}</Td>
                <Td>
                  <ReportStatusBadge value={r.status} />
                  {r.sentAt && <span className="text-ink-muted block text-xs">versendet {formatDateTime(r.sentAt)}</span>}
                </Td>
                <Td>{r.versions}</Td>
                <Td>
                  {r.deliveries}
                  {r.failed > 0 && <span className="text-negative block text-xs font-semibold">{r.failed} fehlgeschlagen</span>}
                </Td>
                <Td>
                  {r.finalVersionId ? (
                    <a
                      className="text-info font-semibold underline"
                      href={`/api/reports/${r.inspectionId}/pdf?version=${r.finalVersionId}&download=1`}
                    >
                      Herunterladen
                    </a>
                  ) : (
                    "–"
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
