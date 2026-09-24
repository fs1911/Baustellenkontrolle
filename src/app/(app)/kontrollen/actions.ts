"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";
import { findingSchema, inspectionSchema, siteSchema, type FindingInput, type InspectionInput, type SiteInput } from "@/lib/domain/validation";
import { canCreateSite } from "@/lib/domain/permissions";
import { saveFinding } from "@/lib/services/findings";
import { recomputeRecurringClusters } from "@/lib/services/recurrence-job";
import { toUserError, type ActionResult } from "@/lib/utils/errors";

/** Wandelt "YYYY-MM-DDTHH:mm" (Ortszeit Zürich) in einen Zeitstempel um. */
function zurichLocalToDate(local: string): Date {
  const [date, time = "00:00"] = local.split("T");
  const guess = new Date(`${date}T${time}:00Z`);
  const zurich = new Date(guess.toLocaleString("en-US", { timeZone: "Europe/Zurich" }));
  const utc = new Date(guess.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(guess.getTime() - (zurich.getTime() - utc.getTime()));
}

export async function createInspectionAction(input: InspectionInput): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  let id: string;
  try {
    const data = inspectionSchema.parse(input);
    id = await withUser(user.id, async (tx) => {
      const [row] = await tx<{ id: string }[]>`
        insert into public.inspections ${tx({
          companyId: data.companyId, siteId: data.siteId, templateId: data.templateId, inspectionType: data.inspectionType,
          inspectedAt: zurichLocalToDate(data.inspectedAt), inspectorId: user.id, weather: data.weather, area: data.area, notes: data.notes,
        })} returning id`;
      if (data.participants.length) {
        await tx`insert into public.inspection_participants ${tx(data.participants.map((p) => ({ ...p, inspectionId: row.id })))}`;
      }
      return row.id;
    });
  } catch (err) {
    return toUserError(err);
  }
  revalidatePath("/kontrollen");
  redirect(`/kontrollen/${id}`);
}

export async function updateInspectionAction(id: string, input: InspectionInput): Promise<ActionResult> {
  const user = await requireUser();
  try {
    const data = inspectionSchema.parse(input);
    await withUser(user.id, async (tx) => {
      const r = await tx`update public.inspections set ${tx({
        inspectionType: data.inspectionType, inspectedAt: zurichLocalToDate(data.inspectedAt), weather: data.weather, area: data.area, notes: data.notes,
      })} where id = ${id}`;
      if (r.count === 0) throw Object.assign(new Error("forbidden"), { code: "42501" });
      await tx`delete from public.inspection_participants where inspection_id = ${id}`;
      if (data.participants.length) {
        await tx`insert into public.inspection_participants ${tx(data.participants.map((p) => ({ ...p, inspectionId: id })))}`;
      }
    });
    revalidatePath(`/kontrollen/${id}`);
    return { ok: true, data: undefined, message: "Kontrolle gespeichert." };
  } catch (err) {
    return toUserError(err);
  }
}

export async function setInspectionStatusAction(id: string, status: "draft" | "completed"): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await withUser(user.id, async (tx) => {
      const r = await tx`update public.inspections set status = ${status}, completed_at = ${status === "completed" ? new Date() : null} where id = ${id}`;
      if (r.count === 0) throw Object.assign(new Error("forbidden"), { code: "42501" });
    });
    if (status === "completed") {
      // Wiederkehrende Abweichungen aktualisieren (nicht blockierend für den Benutzer)
      recomputeRecurringClusters().catch((e) => console.error("Clusterberechnung fehlgeschlagen", e));
    }
    revalidatePath(`/kontrollen/${id}`);
    return { ok: true, data: undefined, message: status === "completed" ? "Kontrolle abgeschlossen." : "Kontrolle wieder geöffnet." };
  } catch (err) {
    return toUserError(err);
  }
}

export async function deleteInspectionAction(id: string): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await withUser(user.id, async (tx) => {
      const r = await tx`update public.inspections set deleted_at = now() where id = ${id} and status = 'draft'
                         and not exists (select 1 from public.generated_reports g where g.inspection_id = ${id} and g.status in ('released','sent'))`;
      if (r.count === 0) throw Object.assign(new Error("Nur Entwürfe ohne freigegebenen Bericht können gelöscht werden."), { code: "42501", message: "Nur Entwürfe ohne freigegebenen Bericht können gelöscht werden (Berechtigung vorbehalten)." });
    });
  } catch (err) {
    return toUserError(err);
  }
  revalidatePath("/kontrollen");
  redirect("/kontrollen");
}

export async function createSiteAction(input: SiteInput): Promise<ActionResult<{ id: string; name: string; siteNumber: string; street: string | null; postalCode: string | null; city: string | null; companyId: string }>> {
  const user = await requireUser();
  try {
    const data = siteSchema.parse(input);
    if (!canCreateSite(user.permissions, data.companyId)) {
      return { ok: false, error: "Sie dürfen für diese Gesellschaft keine Baustellen anlegen." };
    }
    const site = await withUser(user.id, async (tx) => {
      const [project] = await tx<{ id: string }[]>`
        insert into public.projects (company_id, project_number, name) values (${data.companyId}, ${data.siteNumber}, ${data.projectName ?? data.name})
        on conflict (company_id, project_number) do update set name = public.projects.name returning id`;
      const [row] = await tx<{ id: string }[]>`
        insert into public.construction_sites ${tx({
          companyId: data.companyId, projectId: project.id, siteNumber: data.siteNumber, name: data.name,
          street: data.street, postalCode: data.postalCode, city: data.city, canton: data.canton,
        })} returning id`;
      return row;
    });
    revalidatePath("/baustellen");
    return { ok: true, data: { id: site.id, name: data.name, siteNumber: data.siteNumber, street: data.street, postalCode: data.postalCode, city: data.city, companyId: data.companyId } };
  } catch (err) {
    return toUserError(err);
  }
}

export async function saveFindingAction(input: FindingInput): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  try {
    const data = findingSchema.parse(input);
    const id = await withUser(user.id, (tx) => saveFinding(tx, data));
    revalidatePath(`/kontrollen/${data.inspectionId}`);
    return { ok: true, data: { id }, message: "Feststellung gespeichert." };
  } catch (err) {
    return toUserError(err);
  }
}

export async function deleteFindingAction(findingId: string, inspectionId: string): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await withUser(user.id, async (tx) => {
      const r = await tx`update public.findings set deleted_at = now() where id = ${findingId}`;
      if (r.count === 0) throw Object.assign(new Error("forbidden"), { code: "42501" });
    });
    revalidatePath(`/kontrollen/${inspectionId}`);
    return { ok: true, data: undefined, message: "Feststellung gelöscht." };
  } catch (err) {
    return toUserError(err);
  }
}

const captionSchema = z.object({ imageId: z.string().uuid(), caption: z.string().trim().max(500) });

export async function updateImageCaptionAction(imageId: string, caption: string): Promise<ActionResult> {
  const user = await requireUser();
  try {
    const d = captionSchema.parse({ imageId, caption });
    await withUser(user.id, async (tx) => {
      const r = await tx`update public.finding_images set caption = ${d.caption || null} where id = ${d.imageId}`;
      if (r.count === 0) throw Object.assign(new Error("forbidden"), { code: "42501" });
    });
    return { ok: true, data: undefined, message: "Bildlegende gespeichert." };
  } catch (err) {
    return toUserError(err);
  }
}

export async function deleteImageAction(imageId: string): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await withUser(user.id, async (tx) => {
      const r = await tx`update public.finding_images set deleted_at = now() where id = ${z.string().uuid().parse(imageId)}`;
      if (r.count === 0) throw Object.assign(new Error("forbidden"), { code: "42501" });
    });
    return { ok: true, data: undefined, message: "Bild entfernt." };
  } catch (err) {
    return toUserError(err);
  }
}
