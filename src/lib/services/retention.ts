import "server-only";
import { withService } from "@/lib/db/client";
import { loadSettings } from "@/lib/repositories/settings";
import { storage } from "@/lib/services/storage";

export interface RetentionResult {
  execute: boolean;
  inspections: number;
  images: number;
  softDeletedImages: number;
  emailLogs: number;
  auditLogs: number;
  aiSuggestions: number;
  files: number;
}

/**
 * Aufbewahrungs- und Löschkonzept (siehe docs/security.md):
 *  - Kontrollen inkl. Feststellungen, Berichte und Dateien nach X Jahren
 *  - Fotos nach Y Jahren (Kontrolle bleibt erhalten)
 *  - Versandprotokolle, Audit Log, KI-Vorschläge nach eigenen Fristen
 *  - Soft-gelöschte Fotos nach 30 Tagen endgültig
 * Trockenlauf zeigt nur Anzahlen. Ausführung wird im Audit Log protokolliert.
 */
export async function runRetention(opts: { execute: boolean; actorId: string }): Promise<RetentionResult> {
  return withService(async (tx) => {
    const r = (await loadSettings(tx)).retention;
    const oldInspections = await tx<{ id: string }[]>`
      select id from public.inspections where inspected_at < now() - make_interval(years => ${r.inspectionsYears})`;
    const inspIds = oldInspections.map((i) => i.id);
    const imgs = await tx<{ id: string; storagePath: string; thumbnailPath: string | null; deleted: boolean }[]>`
      select id, storage_path, thumbnail_path, deleted_at is not null as deleted from public.finding_images
      where (created_at < now() - make_interval(years => ${r.imagesYears}))
         or (deleted_at is not null and deleted_at < now() - interval '30 days')
         or finding_id in (select id from public.findings where inspection_id = any(${inspIds}::uuid[]))`;
    const reports = await tx<{ pdfPath: string }[]>`
      select v.pdf_path from public.report_versions v join public.generated_reports g on g.id = v.report_id
      where g.inspection_id = any(${inspIds}::uuid[]) and v.pdf_path is not null`;
    const [counts] = await tx<{ email: number; audit: number; ai: number }[]>`
      select (select count(*)::int from public.email_deliveries where created_at < now() - make_interval(years => ${r.emailLogYears})) as email,
             (select count(*)::int from public.audit_logs where occurred_at < now() - make_interval(years => ${r.auditLogYears})) as audit,
             (select count(*)::int from public.ai_suggestions where created_at < now() - make_interval(days => ${r.aiSuggestionsDays})) as ai`;
    const result: RetentionResult = {
      execute: opts.execute,
      inspections: inspIds.length,
      images: imgs.filter((i) => !i.deleted).length,
      softDeletedImages: imgs.filter((i) => i.deleted).length,
      emailLogs: counts.email,
      auditLogs: counts.audit,
      aiSuggestions: counts.ai,
      files: imgs.length * 2 + reports.length,
    };
    if (opts.execute) {
      await storage()
        .remove(
          "finding-images",
          imgs.flatMap((i) => [i.storagePath, i.thumbnailPath].filter((p): p is string => !!p)),
        )
        .catch(() => {});
      await storage()
        .remove(
          "generated-reports",
          reports.map((x) => x.pdfPath),
        )
        .catch(() => {});
      await tx`delete from public.finding_images where id = any(${imgs.map((i) => i.id)}::uuid[])`;
      await tx`delete from public.email_deliveries where created_at < now() - make_interval(years => ${r.emailLogYears})`;
      await tx`delete from public.email_deliveries where report_id in (select id from public.generated_reports where inspection_id = any(${inspIds}::uuid[]))`;
      await tx`delete from public.inspections where id = any(${inspIds}::uuid[])`;
      await tx`delete from public.ai_suggestions where created_at < now() - make_interval(days => ${r.aiSuggestionsDays})`;
      await tx`delete from public.audit_logs where occurred_at < now() - make_interval(years => ${r.auditLogYears})`;
      await tx`insert into public.audit_logs (actor_id, entity_type, entity_id, action, context) values (${opts.actorId}, 'retention', 'run', 'retention_run', ${tx.json({ ...result })})`;
    }
    return result;
  });
}
