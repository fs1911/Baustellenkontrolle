import "server-only";
import { createHash } from "node:crypto";
import { withService, withUser, type Tx } from "@/lib/db/client";
import type { CurrentUser } from "@/lib/auth/session";
import { canEditSite, canSendToArbitraryRecipients } from "@/lib/domain/permissions";
import { bodyToHtml, checkRecipientPolicy } from "@/lib/domain/email";
import type { ReportStatus } from "@/lib/domain/enums";
import { loadSettings } from "@/lib/repositories/settings";
import { mailer, MailDeliveryError } from "@/lib/services/mail";
import { renderReportPdf } from "@/lib/services/pdf/render";
import { storage } from "@/lib/services/storage";
import { buildReportContent, type ReportContent } from "./model";

export interface ReportRecord {
  id: string;
  inspectionId: string;
  companyId: string;
  siteId: string;
  reportNumber: string;
  status: ReportStatus;
  currentVersionId: string | null;
}

export async function getReportForInspection(tx: Tx, inspectionId: string): Promise<ReportRecord | null> {
  const [r] = await tx<ReportRecord[]>`
    select id, inspection_id, company_id, site_id, report_number, status, current_version_id
    from public.generated_reports where inspection_id = ${inspectionId}`;
  return r ?? null;
}

/** Legt den Bericht an (Berichtsnummer je Gesellschaft), falls noch nicht vorhanden. */
export async function ensureReport(tx: Tx, inspectionId: string): Promise<ReportRecord> {
  const existing = await getReportForInspection(tx, inspectionId);
  if (existing) return existing;
  await tx`insert into public.generated_reports (inspection_id) values (${inspectionId})`;
  return (await getReportForInspection(tx, inspectionId))!;
}

export interface LatestVersion {
  id: string;
  versionNo: number;
  isFinal: boolean;
  summaryText: string | null;
  closingText: string | null;
  pdfPath: string | null;
  createdAt: Date;
  createdByName: string | null;
}

export async function listVersions(tx: Tx, reportId: string): Promise<LatestVersion[]> {
  return tx<LatestVersion[]>`
    select v.id, v.version_no, v.is_final, v.summary_text, v.closing_text, v.pdf_path, v.created_at, p.full_name as created_by_name
    from public.report_versions v left join public.user_profiles p on p.id = v.created_by
    where v.report_id = ${reportId} order by v.version_no desc`;
}

async function nextVersionNo(tx: Tx, reportId: string): Promise<number> {
  const [{ n }] = await tx<
    { n: number }[]
  >`select coalesce(max(version_no), 0) + 1 as n from public.report_versions where report_id = ${reportId}`;
  return n;
}

/** Speichert die bearbeiteten Texte als neue (nicht finale) Entwurfsversion. */
export async function saveDraft(user: CurrentUser, inspectionId: string, texts: { summaryText: string; closingText: string }) {
  return withUser(user.id, async (tx) => {
    const report = await ensureReport(tx, inspectionId);
    if (!canEditSite(user.permissions, report.siteId)) throw Object.assign(new Error("forbidden"), { code: "42501" });
    if (report.status === "released" || report.status === "sent") {
      await tx`update public.generated_reports set status = 'in_review', released_at = null, released_by = null where id = ${report.id}`;
    }
    const versionNo = await nextVersionNo(tx, report.id);
    const built = await buildReportContent(tx, inspectionId, {
      reportNumber: report.reportNumber,
      versionNo,
      status: "in_review",
      ...texts,
    });
    if (!built) throw Object.assign(new Error("forbidden"), { code: "42501" });
    const [v] = await tx<{ id: string }[]>`
      insert into public.report_versions (report_id, version_no, content, summary_text, closing_text)
      values (${report.id}, ${versionNo}, ${tx.json(built.content as never)}, ${texts.summaryText}, ${texts.closingText}) returning id`;
    await tx`update public.generated_reports set status = case when status = 'draft' then 'in_review'::public.report_status else status end,
             current_version_id = ${v.id} where id = ${report.id}`;
    return { versionId: v.id, versionNo };
  });
}

/** Live-Vorschau (nicht gespeichert) – z. B. für PDF-Vorschau vor der Freigabe. */
export async function previewContent(
  user: CurrentUser,
  inspectionId: string,
  texts?: { summaryText?: string | null; closingText?: string | null },
) {
  return withUser(user.id, async (tx) => {
    const report = await getReportForInspection(tx, inspectionId);
    const versions = report ? await listVersions(tx, report.id) : [];
    const latest = versions[0];
    return buildReportContent(tx, inspectionId, {
      reportNumber: report?.reportNumber ?? "ENTWURF",
      versionNo: (latest?.versionNo ?? 0) + (latest?.isFinal ? 1 : latest ? 0 : 1),
      status: report?.status === "sent" || report?.status === "released" ? report.status : "draft",
      summaryText: texts?.summaryText ?? latest?.summaryText ?? null,
      closingText: texts?.closingText ?? latest?.closingText ?? null,
    });
  });
}

export interface SendRequest {
  summaryText: string;
  closingText: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
}

export interface SendResult {
  reportNumber: string;
  versionNo: number;
  deliveryId: string;
  status: "sent" | "failed";
  error?: string;
}

/**
 * Freigabe und Versand – nur nach expliziter Benutzeraktion:
 * 1. Berechtigung + Empfängerprüfung  2. finale Version + PDF (SHA-256)  3. Freigabe protokollieren
 * 4. Versandprotokoll (queued) → Versand → Status sent/failed  5. Berichtstatus "Versendet".
 */
export async function releaseAndSend(user: CurrentUser, inspectionId: string, req: SendRequest): Promise<SendResult> {
  const prepared = await withUser(user.id, async (tx) => {
    const report = await ensureReport(tx, inspectionId);
    if (!canEditSite(user.permissions, report.siteId)) throw Object.assign(new Error("forbidden"), { code: "42501" });
    const [company] = await tx<
      { defaultDistribution: string[]; emailSenderName: string | null; name: string; primaryColor: string | null }[]
    >`
      select default_distribution, email_sender_name, name, primary_color from public.companies where id = ${report.companyId}`;
    const siteMembers = await tx<{ email: string }[]>`
      select p.business_email as email from public.site_memberships m join public.user_profiles p on p.id = m.user_id
      where m.site_id = ${report.siteId} and p.is_active`;
    const errors = checkRecipientPolicy({
      to: req.to,
      cc: req.cc,
      bcc: req.bcc,
      senderEmail: user.businessEmail,
      companyDistribution: company.defaultDistribution,
      siteMemberEmails: siteMembers.map((m) => m.email),
      mayUseArbitraryRecipients: canSendToArbitraryRecipients(user.permissions, report.companyId),
    });
    if (errors.length) throw Object.assign(new Error(errors.join(" ")), { code: "42501", message: `${errors.join(" ")} (Berechtigung)` });

    const versionNo = await nextVersionNo(tx, report.id);
    const built = await buildReportContent(tx, inspectionId, {
      reportNumber: report.reportNumber,
      versionNo,
      status: "sent",
      summaryText: req.summaryText,
      closingText: req.closingText,
    });
    if (!built) throw Object.assign(new Error("forbidden"), { code: "42501" });
    const pdf = await renderReportPdf(built.content);
    const sha256 = createHash("sha256").update(pdf).digest("hex");
    const pdfPath = `${report.companyId}/${report.siteId}/${report.id}/${report.reportNumber}-v${versionNo}.pdf`;
    await storage().put("generated-reports", pdfPath, pdf, "application/pdf");
    const [v] = await tx<{ id: string }[]>`
      insert into public.report_versions (report_id, version_no, is_final, content, summary_text, closing_text, pdf_path, pdf_sha256)
      values (${report.id}, ${versionNo}, true, ${tx.json(built.content as never)}, ${req.summaryText}, ${req.closingText}, ${pdfPath}, ${sha256})
      returning id`;
    await tx`update public.generated_reports set status = 'released', released_at = now(), released_by = app.uid(), current_version_id = ${v.id}
             where id = ${report.id}`;
    await tx`select app.log_event('generated_reports', ${report.id}, 'release', ${report.companyId}, ${tx.json({ versionNo, sha256 })})`;
    const [d] = await tx<{ id: string }[]>`
      insert into public.email_deliveries (report_id, report_version_id, to_addresses, cc_addresses, bcc_addresses, subject, body_text, provider)
      values (${report.id}, ${v.id}, ${req.to}, ${req.cc}, ${req.bcc}, ${req.subject}, ${req.body}, ${mailer().name}) returning id`;
    return { report, versionNo, deliveryId: d.id, pdf, content: built.content, company };
  });

  const disclaimer = prepared.content.company.disclaimer;
  const result = await deliver(user, prepared.deliveryId, {
    pdf: prepared.pdf,
    filename: `${prepared.report.reportNumber}_Baustellenkontrollbericht.pdf`,
    fromName: prepared.company.emailSenderName ?? prepared.company.name,
    html: bodyToHtml(req.body, { companyName: prepared.company.name, primaryColor: prepared.company.primaryColor, disclaimer }),
    req,
  });
  return { reportNumber: prepared.report.reportNumber, versionNo: prepared.versionNo, deliveryId: prepared.deliveryId, ...result };
}

async function deliver(
  user: CurrentUser,
  deliveryId: string,
  m: { pdf: Buffer; filename: string; fromName: string; html: string; req: Pick<SendRequest, "to" | "cc" | "bcc" | "subject" | "body"> },
): Promise<{ status: "sent" | "failed"; error?: string }> {
  await withUser(
    user.id,
    (tx) => tx`update public.email_deliveries set status = 'sending', attempts = attempts + 1 where id = ${deliveryId}`,
  );
  try {
    const res = await mailer().send({
      fromName: m.fromName,
      replyTo: user.businessEmail,
      to: m.req.to,
      cc: m.req.cc,
      bcc: m.req.bcc,
      subject: m.req.subject,
      text: m.req.body,
      html: m.html,
      attachments: [{ filename: m.filename, content: m.pdf, contentType: "application/pdf" }],
    });
    await withUser(user.id, async (tx) => {
      const [d] = await tx<{ reportId: string; companyId: string }[]>`
        update public.email_deliveries set status = 'sent', sent_at = now(), provider_message_id = ${res.messageId}, last_error = null
        where id = ${deliveryId} returning report_id, company_id`;
      await tx`update public.generated_reports set status = 'sent', sent_at = now() where id = ${d.reportId}`;
      await tx`select app.log_event('email_deliveries', ${deliveryId}, 'send', ${d.companyId}, ${tx.json({ to: m.req.to, cc: m.req.cc, bcc: m.req.bcc, provider: res.provider })})`;
    });
    return { status: "sent" };
  } catch (err) {
    const message = err instanceof MailDeliveryError ? err.message : "Versand fehlgeschlagen (technischer Fehler).";
    console.error("Mailversand fehlgeschlagen", err);
    // Status auch dann protokollieren, wenn die Benutzersitzung keine Rechte mehr hätte
    await withService(async (tx) => {
      const [d] = await tx<{ reportId: string }[]>`
        update public.email_deliveries set status = 'failed', last_error = ${message} where id = ${deliveryId} returning report_id`;
      await tx`update public.generated_reports set status = 'send_failed' where id = ${d.reportId}`;
      await tx`insert into public.audit_logs (actor_id, entity_type, entity_id, action, context)
               values (${user.id}, 'email_deliveries', ${deliveryId}, 'send_failed', ${tx.json({ error: message })})`;
    });
    return { status: "failed", error: message };
  }
}

/** Erneuter Versand eines fehlgeschlagenen Auftrags (Absender oder Admin/IMS der Gesellschaft). */
export async function retryDelivery(user: CurrentUser, deliveryId: string) {
  const data = await withUser(user.id, async (tx) => {
    const [d] = await tx<
      {
        id: string;
        status: string;
        reportVersionId: string;
        toAddresses: string[];
        ccAddresses: string[];
        bccAddresses: string[];
        subject: string;
        bodyText: string;
        companyId: string;
      }[]
    >`
      select id, status, report_version_id, to_addresses, cc_addresses, bcc_addresses, subject, body_text, company_id
      from public.email_deliveries where id = ${deliveryId}
        and (sent_by = app.uid() or company_id = any(${user.permissions.manageable_company_ids}::uuid[]))`;
    if (!d) throw Object.assign(new Error("forbidden"), { code: "42501" });
    if (d.status !== "failed")
      throw Object.assign(new Error("Nur fehlgeschlagene Versandaufträge können wiederholt werden."), {
        code: "23514",
        message: "Nur fehlgeschlagene Versandaufträge können wiederholt werden.",
      });
    const [v] = await tx<
      { pdfPath: string; content: ReportContent }[]
    >`select pdf_path, content from public.report_versions where id = ${d.reportVersionId}`;
    const [c] = await tx<
      { name: string; emailSenderName: string | null; primaryColor: string | null }[]
    >`select name, email_sender_name, primary_color from public.companies where id = ${d.companyId}`;
    return { d, v, c };
  });
  const pdf = await storage().get("generated-reports", data.v.pdfPath);
  return deliver(user, deliveryId, {
    pdf,
    filename: `${data.v.content.reportNumber}_Baustellenkontrollbericht.pdf`,
    fromName: data.c.emailSenderName ?? data.c.name,
    html: bodyToHtml(data.d.bodyText, {
      companyName: data.c.name,
      primaryColor: data.c.primaryColor,
      disclaimer: data.v.content.company.disclaimer,
    }),
    req: { to: data.d.toAddresses, cc: data.d.ccAddresses, bcc: data.d.bccAddresses, subject: data.d.subject, body: data.d.bodyText },
  });
}

export async function reportSettings(user: CurrentUser) {
  return withUser(user.id, (tx) => loadSettings(tx));
}
