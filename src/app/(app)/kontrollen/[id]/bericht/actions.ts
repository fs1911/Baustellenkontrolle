"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";
import { parseAddressList } from "@/lib/domain/email";
import { loadSettings } from "@/lib/repositories/settings";
import { suggestSummary } from "@/lib/services/ai";
import { previewContent, releaseAndSend, retryDelivery, saveDraft } from "@/lib/services/reports/service";
import { toUserError, type ActionResult } from "@/lib/utils/errors";

const textsSchema = z.object({
  summaryText: z.string().max(6000, "Die Zusammenfassung ist zu lang."),
  closingText: z.string().max(4000, "Die Schlussbemerkung ist zu lang."),
});

export async function saveReportDraftAction(
  inspectionId: string,
  texts: { summaryText: string; closingText: string },
): Promise<ActionResult<{ versionNo: number }>> {
  const user = await requireUser();
  try {
    const data = textsSchema.parse(texts);
    const r = await saveDraft(user, z.string().uuid().parse(inspectionId), data);
    revalidatePath(`/kontrollen/${inspectionId}/bericht`);
    return { ok: true, data: { versionNo: r.versionNo }, message: `Entwurf gespeichert (Version ${r.versionNo}).` };
  } catch (err) {
    return toUserError(err);
  }
}

export async function suggestSummaryAction(
  inspectionId: string,
): Promise<ActionResult<{ text: string; provider: string; note: string | null }>> {
  const user = await requireUser();
  try {
    const built = await previewContent(user, z.string().uuid().parse(inspectionId));
    if (!built) return { ok: false, error: "Kontrolle nicht gefunden." };
    const settings = await withUser(user.id, (tx) => loadSettings(tx));
    const r = await suggestSummary(built.summaryInput, settings);
    await withUser(
      user.id,
      (tx) => tx`
      insert into public.ai_suggestions (inspection_id, kind, provider, model, input_hash, suggestion, explanation)
      values (${inspectionId}, 'summary', ${r.provider}, ${r.model}, ${r.inputHash}, ${tx.json({ text: r.value })}, 'Management Summary aus gespeicherten Kontrolldaten')`,
    );
    return { ok: true, data: { text: r.value, provider: r.provider, note: r.fallbackReason ?? null } };
  } catch (err) {
    return toUserError(err);
  }
}

const sendSchema = z.object({
  summaryText: z.string().max(6000),
  closingText: z.string().max(4000),
  to: z.string(),
  cc: z.string(),
  bcc: z.string(),
  subject: z.string().trim().min(3, "Betreff erforderlich").max(300),
  body: z.string().trim().min(5, "E-Mail-Text erforderlich").max(20000),
  confirmed: z.literal(true, { message: "Bitte die Freigabe bestätigen." }),
});

export async function releaseAndSendAction(
  inspectionId: string,
  input: z.input<typeof sendSchema>,
): Promise<ActionResult<{ reportNumber: string; versionNo: number; status: "sent" | "failed"; error?: string }>> {
  const user = await requireUser();
  try {
    const d = sendSchema.parse(input);
    const to = parseAddressList(d.to);
    const cc = parseAddressList(d.cc);
    const bcc = parseAddressList(d.bcc);
    const invalid = [...to.invalid, ...cc.invalid, ...bcc.invalid];
    if (invalid.length) return { ok: false, error: `Ungültige E-Mail-Adresse(n): ${invalid.join(", ")}` };
    const r = await releaseAndSend(user, z.string().uuid().parse(inspectionId), {
      summaryText: d.summaryText,
      closingText: d.closingText,
      to: to.valid,
      cc: cc.valid,
      bcc: bcc.valid,
      subject: d.subject,
      body: d.body,
    });
    revalidatePath(`/kontrollen/${inspectionId}/bericht`);
    revalidatePath(`/kontrollen/${inspectionId}`);
    return {
      ok: true,
      data: r,
      message:
        r.status === "sent"
          ? `Bericht ${r.reportNumber} (Version ${r.versionNo}) freigegeben und versendet.`
          : `Bericht freigegeben, Versand fehlgeschlagen: ${r.error}`,
    };
  } catch (err) {
    return toUserError(err);
  }
}

export async function retryDeliveryAction(deliveryId: string, inspectionId: string): Promise<ActionResult> {
  const user = await requireUser();
  try {
    const r = await retryDelivery(user, z.string().uuid().parse(deliveryId));
    revalidatePath(`/kontrollen/${inspectionId}/bericht`);
    return r.status === "sent"
      ? { ok: true, data: undefined, message: "Versand erfolgreich wiederholt." }
      : { ok: false, error: r.error ?? "Versand erneut fehlgeschlagen." };
  } catch (err) {
    return toUserError(err);
  }
}
