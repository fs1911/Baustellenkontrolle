import "server-only";
import { randomUUID } from "node:crypto";
import type { Tx } from "@/lib/db/client";
import type { FindingData } from "@/lib/domain/validation";
import { processPhoto } from "@/lib/services/images";
import { storage } from "@/lib/services/storage";
import { loadSettings } from "@/lib/repositories/settings";

/**
 * Speichert eine Feststellung inkl. primärer Massnahme und Referenzen – unter RLS des Benutzers.
 * Wird von Server Actions und der Offline-Synchronisation gleichermassen verwendet.
 */
export async function saveFinding(tx: Tx, data: FindingData, opts: { clientRef?: string | null } = {}): Promise<string> {
  let findingId = data.id;
  const findingValues = {
    title: data.title,
    description: data.description,
    assessment: data.assessment,
    categoryId: data.categoryId,
    subcategoryId: data.subcategoryId,
    riskLevel: data.assessment === "positive" ? null : data.riskLevel,
    trade: data.trade,
    location: data.location,
    responsibleRole: data.responsibleRole,
    referenceNote: data.referenceNote,
  };

  if (findingId) {
    const res = await tx`
      update public.findings set ${tx(findingValues)}
      where id = ${findingId} and inspection_id = ${data.inspectionId} and deleted_at is null`;
    if (res.count === 0) throw Object.assign(new Error("Keine Berechtigung"), { code: "42501" });
  } else {
    if (opts.clientRef) {
      const [existing] = await tx<{ id: string }[]>`select id from public.findings where client_ref = ${opts.clientRef}`;
      if (existing) return existing.id; // bereits synchronisiert (idempotent)
    }
    const [row] = await tx<{ id: string }[]>`
      insert into public.findings ${tx({ ...findingValues, inspectionId: data.inspectionId, clientRef: opts.clientRef ?? null })}
      returning id`;
    findingId = row.id;
  }

  // Primäre Massnahme
  if (data.assessment === "positive") {
    await tx`delete from public.corrective_actions where finding_id = ${findingId}`;
  } else if (data.actionDescription) {
    const [action] = await tx<{ id: string; status: string }[]>`
      select id, status from public.corrective_actions where finding_id = ${findingId} order by created_at limit 1`;
    const status = data.status ?? (action?.status as FindingData["status"]) ?? "open";
    const note = data.completionNote;
    const values = {
      description: data.actionDescription,
      responsibleRole: data.responsibleRole,
      responsiblePerson: data.responsiblePerson,
      dueDate: data.dueDate,
      status,
      completionNote: status === "resolved" || status === "verified" || status === "closed" ? note : null,
      verificationNote: status === "verified" || status === "closed" ? note : null,
    };
    if (action) {
      await tx`update public.corrective_actions set ${tx(values)} where id = ${action.id}`;
      if (action.status !== status) {
        await tx`insert into public.action_updates (action_id, comment, status_from, status_to)
                 values (${action.id}, ${note}, ${action.status}, ${status})`;
      }
    } else {
      await tx`insert into public.corrective_actions ${tx({ ...values, findingId })}`;
    }
  }

  // Referenzen (Orientierungshilfen)
  await tx`delete from public.finding_references where finding_id = ${findingId}`;
  const refIds = Array.from(new Set(data.referenceIds));
  if (refIds.length) {
    await tx`insert into public.finding_references ${tx(
      refIds.map((id) => ({ findingId, legalReferenceId: id, suggestedByAi: data.aiReferenceIds.includes(id) })),
    )}`;
  }

  // Entscheidung zum KI-Vorschlag protokollieren (menschliche Freigabe)
  if (data.aiSuggestionId && data.aiDecision) {
    await tx`update public.ai_suggestions set status = ${data.aiDecision}, decided_by = app.uid(), decided_at = now(), finding_id = ${findingId}
             where id = ${data.aiSuggestionId}`;
  }
  return findingId;
}

/** Nimmt ein Foto entgegen, verarbeitet es serverseitig und speichert es zugriffsgeschützt. */
export async function addFindingImage(
  tx: Tx,
  findingId: string,
  file: { data: Buffer; caption: string | null; clientRef?: string | null },
): Promise<{ id: string }> {
  const [finding] = await tx<{ companyId: string; siteId: string }[]>`
    select company_id, site_id from public.findings where id = ${findingId} and deleted_at is null`;
  if (!finding) throw Object.assign(new Error("Feststellung nicht gefunden"), { code: "42501" });
  if (file.clientRef) {
    const [existing] = await tx<{ id: string }[]>`select id from public.finding_images where client_ref = ${file.clientRef}`;
    if (existing) return existing;
  }
  const settings = await loadSettings(tx);
  const processed = await processPhoto(file.data, { stripMetadata: settings.images.stripMetadata });
  const id = randomUUID();
  const base = `${finding.companyId}/${finding.siteId}/${findingId}/${id}`;
  const [{ next }] = await tx<{ next: number }[]>`
    select coalesce(max(sort_order), -1) + 1 as next from public.finding_images where finding_id = ${findingId}`;
  // Zuerst DB-Eintrag (RLS-Prüfung), dann Upload; bei Upload-Fehler rollt die Transaktion zurück.
  await tx`insert into public.finding_images ${tx({
    id,
    findingId,
    storagePath: `${base}.jpg`,
    thumbnailPath: `${base}-thumb.jpg`,
    caption: file.caption,
    mimeType: processed.mimeType,
    width: processed.width,
    height: processed.height,
    sizeBytes: processed.data.byteLength,
    metadataStripped: processed.metadataStripped,
    sortOrder: next,
    clientRef: file.clientRef ?? null,
  })}`;
  await storage().put("finding-images", `${base}.jpg`, processed.data, "image/jpeg");
  await storage().put("finding-images", `${base}-thumb.jpg`, processed.thumbnail, "image/jpeg");
  return { id };
}
