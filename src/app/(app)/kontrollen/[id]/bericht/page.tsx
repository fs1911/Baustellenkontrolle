import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, FileDown } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { withUser } from "@/lib/db/client";
import { canEditSite, canSendToArbitraryRecipients } from "@/lib/domain/permissions";
import { defaultBody, defaultSubject } from "@/lib/domain/email";
import { DELIVERY_STATUS_LABEL, type DeliveryStatus } from "@/lib/domain/enums";
import { buildRuleSummary } from "@/lib/domain/summary";
import { loadSettings } from "@/lib/repositories/settings";
import { describeAiMode } from "@/lib/services/ai";
import { ensureReport, getReportForInspection, listVersions, previewContent } from "@/lib/services/reports/service";
import { storage } from "@/lib/services/storage";
import { formatDateTime } from "@/lib/utils/format";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert, PageHeader } from "@/components/ui/feedback";
import { ReportStatusBadge, Tag } from "@/components/ui/badges";
import { Table, THead, Th, Td } from "@/components/ui/table";
import { ReportPreview } from "@/components/app/report-preview";
import { ReportWorkspace, type RecipientOption } from "@/components/app/report-workspace";
import { DeliveryRetry } from "@/components/app/delivery-retry";

export const metadata: Metadata = { title: "Berichtsvorschau" };

const MAIL_MODE: Record<string, string> = {
  sandbox: "Sandbox (Entwicklung) – E-Mails werden nicht zugestellt, sondern unter Verwaltung → Mail-Sandbox abgelegt",
  smtp: "SMTP",
  graph: "Microsoft 365 (Graph)",
};

export default async function ReportPage({ params }: PageProps<"/kontrollen/[id]/bericht">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await requireUser();
  // Bericht (inkl. Berichtsnummer der Gesellschaft) beim ersten Öffnen durch Berechtigte anlegen
  await withUser(user.id, async (tx) => {
    const [insp] = await tx<{ siteId: string }[]>`select site_id from public.inspections where id = ${id} and deleted_at is null`;
    if (insp && canEditSite(user.permissions, insp.siteId)) await ensureReport(tx, id);
  });
  const built = await previewContent(user, id);
  if (!built) notFound();
  const c = built.content;
  const data = await withUser(user.id, async (tx) => {
    const report = await getReportForInspection(tx, id);
    const versions = report ? await listVersions(tx, report.id) : [];
    const deliveries = report
      ? await tx<
          {
            id: string;
            status: DeliveryStatus;
            toAddresses: string[];
            ccAddresses: string[];
            bccAddresses: string[];
            subject: string;
            sentAt: Date | null;
            createdAt: Date;
            lastError: string | null;
            attempts: number;
            senderName: string;
            versionNo: number;
            provider: string;
          }[]
        >`
          select d.id, d.status, d.to_addresses, d.cc_addresses, d.bcc_addresses, d.subject, d.sent_at, d.created_at, d.last_error, d.attempts,
                 p.full_name as sender_name, v.version_no, d.provider
          from public.email_deliveries d join public.user_profiles p on p.id = d.sent_by join public.report_versions v on v.id = d.report_version_id
          where d.report_id = ${report.id} order by d.created_at desc`
      : [];
    const [company] = await tx<
      { defaultDistribution: string[] }[]
    >`select default_distribution from public.companies where id = ${c.company.id}`;
    const [site] = await tx<{ siteId: string }[]>`select site_id from public.inspections where id = ${id}`;
    const members = await tx<{ email: string; name: string }[]>`
      select distinct p.business_email as email, p.full_name as name from public.site_memberships m join public.user_profiles p on p.id = m.user_id
      where m.site_id = ${site.siteId} and p.is_active`;
    const settings = await loadSettings(tx);
    return { report, versions, deliveries, company, siteId: site.siteId, members, settings };
  });

  const imageUrls: Record<string, string> = {};
  for (const f of c.findings) for (const img of f.images) imageUrls[img.path] = await storage().signedUrl("finding-images", img.path);
  const logoUrl = c.company.logoPath ? await storage().signedUrl("company-logos", c.company.logoPath) : null;
  const canEdit = canEditSite(user.permissions, data.siteId);
  const latest = data.versions[0];
  const summary = latest?.summaryText ?? buildRuleSummary(built.summaryInput);

  const recipients: RecipientOption[] = [
    { email: user.businessEmail, label: "Eigene Geschäftsadresse", defaultChecked: true },
    ...(data.company?.defaultDistribution ?? []).map((e) => ({
      email: e,
      label: "Standardverteiler der Gesellschaft",
      defaultChecked: false,
    })),
    ...data.members.filter((m) => m.email !== user.businessEmail).map((m) => ({ email: m.email, label: m.name, defaultChecked: false })),
  ];
  const mailCtx = {
    companyName: c.company.name,
    siteName: c.inspection.siteName,
    siteNumber: c.inspection.siteNumber,
    inspectionDate: c.inspection.date,
    reportNumber: c.reportNumber,
    senderName: user.fullName,
    summary,
    positives: c.counts.positive,
    deviations: c.counts.negative,
    improvements: c.counts.improvement,
    openActions: c.counts.openActions,
    criticalOrHigh: c.counts.criticalOrHigh,
  };

  return (
    <>
      <PageHeader
        back={
          <Link
            href={`/kontrollen/${id}`}
            className="text-ink-muted hover:text-ink inline-flex min-h-10 items-center gap-1 text-sm font-semibold"
          >
            <ChevronLeft className="size-4" aria-hidden /> Zur Kontrolle
          </Link>
        }
        title="Bericht prüfen, freigeben und versenden"
        description={
          <span className="flex flex-wrap items-center gap-2">
            {c.company.name} · {c.inspection.siteName} ·{" "}
            {data.report ? (
              <>
                Bericht-ID {data.report.reportNumber} <ReportStatusBadge value={data.report.status} />
              </>
            ) : (
              "noch nicht gespeichert"
            )}
          </span>
        }
      />
      {c.findings.length === 0 && (
        <Alert tone="warning" className="mb-5">
          Die Kontrolle enthält noch keine Feststellungen.
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="order-2 xl:order-1">
          <h2 className="mb-3 text-xl font-bold">Vorschau</h2>
          <ReportPreview content={{ ...c, summaryText: summary }} logoUrl={logoUrl} imageUrls={imageUrls} />
        </div>
        <div className="order-1 space-y-5 xl:order-2">
          <ReportWorkspace
            inspectionId={id}
            initialSummary={summary}
            initialClosing={latest?.closingText ?? c.closingText}
            recipients={recipients}
            allowFree={canSendToArbitraryRecipients(user.permissions, c.company.id)}
            defaultSubject={defaultSubject(mailCtx)}
            defaultBody={defaultBody(mailCtx)}
            mailMode={MAIL_MODE[env().MAIL_PROVIDER]}
            aiMode={describeAiMode(data.settings)}
            canEdit={canEdit}
            isSent={data.report?.status === "sent"}
          />

          <Card>
            <CardHeader
              title="Berichtsversionen"
              description="Finale Versionen sind unveränderlich und mit SHA-256-Prüfsumme archiviert."
            />
            <CardBody>
              {data.versions.length === 0 ? (
                <p className="text-ink-muted">Noch keine gespeicherte Version.</p>
              ) : (
                <ul className="space-y-2">
                  {data.versions.map((v) => (
                    <li key={v.id} className="border-line flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-sm">
                      <span>
                        Version {v.versionNo} · {formatDateTime(v.createdAt)} · {v.createdByName ?? "–"}{" "}
                        {v.isFinal ? <Tag className="text-positive">final</Tag> : <Tag>Entwurf</Tag>}
                      </span>
                      <a
                        className="text-info inline-flex min-h-10 items-center gap-1 font-semibold underline"
                        href={`/api/reports/${id}/pdf?version=${v.id}&download=1`}
                      >
                        <FileDown className="size-4" aria-hidden /> PDF
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Versandprotokoll" />
            <CardBody>
              {data.deliveries.length === 0 ? (
                <p className="text-ink-muted">Noch kein Versand.</p>
              ) : (
                <Table caption="Versandprotokoll">
                  <THead>
                    <tr>
                      <Th>Zeitpunkt</Th>
                      <Th>Empfänger</Th>
                      <Th>Version</Th>
                      <Th>Status</Th>
                    </tr>
                  </THead>
                  <tbody>
                    {data.deliveries.map((d) => (
                      <tr key={d.id}>
                        <Td>
                          {formatDateTime(d.sentAt ?? d.createdAt)}
                          <br />
                          <span className="text-ink-muted text-xs">
                            {d.senderName} · {d.provider}
                          </span>
                        </Td>
                        <Td className="break-all">
                          {d.toAddresses.join(", ")}
                          {d.ccAddresses.length > 0 && (
                            <>
                              <br />
                              CC: {d.ccAddresses.join(", ")}
                            </>
                          )}
                          {d.bccAddresses.length > 0 && (
                            <>
                              <br />
                              BCC: {d.bccAddresses.join(", ")}
                            </>
                          )}
                        </Td>
                        <Td>{d.versionNo}</Td>
                        <Td>
                          <span
                            className={
                              d.status === "failed"
                                ? "text-negative font-semibold"
                                : d.status === "sent"
                                  ? "text-positive font-semibold"
                                  : ""
                            }
                          >
                            {DELIVERY_STATUS_LABEL[d.status]}
                          </span>
                          {d.lastError && <p className="text-negative text-xs">{d.lastError}</p>}
                          {d.status === "failed" && (
                            <div className="mt-1">
                              <DeliveryRetry deliveryId={d.id} inspectionId={id} />
                            </div>
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
