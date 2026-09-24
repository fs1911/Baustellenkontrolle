"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";
import { recomputeRecurringClusters } from "@/lib/services/recurrence-job";
import { toUserError, type ActionResult } from "@/lib/utils/errors";

export async function recomputeAction(): Promise<ActionResult<{ clusters: number }>> {
  const user = await requireUser();
  if (!user.permissions.is_catalog_editor) return { ok: false, error: "Nur Administration und Gruppen-IMS/SIBE können die Analyse neu starten." };
  try {
    const r = await recomputeRecurringClusters();
    await withUser(user.id, (tx) => tx`select app.log_event('recurring_issue_clusters', null, 'recompute', null, ${tx.json({ clusters: r.clusters })})`);
    revalidatePath("/wiederkehrend");
    return { ok: true, data: r, message: `${r.clusters} Muster berechnet.` };
  } catch (err) {
    return toUserError(err);
  }
}

export async function setClusterStatusAction(id: string, status: "active" | "acknowledged" | "resolved"): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await withUser(user.id, async (tx) => {
      const r = await tx`update public.recurring_issue_clusters set status = ${z.enum(["active", "acknowledged", "resolved"]).parse(status)} where id = ${z.string().uuid().parse(id)}`;
      if (r.count === 0) throw Object.assign(new Error("forbidden"), { code: "42501" });
    });
    revalidatePath("/wiederkehrend");
    return { ok: true, data: undefined, message: "Status aktualisiert." };
  } catch (err) {
    return toUserError(err);
  }
}
