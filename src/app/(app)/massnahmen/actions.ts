"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";
import { actionUpdateSchema } from "@/lib/domain/validation";
import { toUserError, type ActionResult } from "@/lib/utils/errors";

/** Statuswechsel einer Massnahme inkl. Verlaufseintrag. Poliere: nur in Bearbeitung/behoben (DB-Trigger erzwingt dies). */
export async function updateActionStatusAction(input: {
  actionId: string;
  status: string;
  comment?: string | null;
}): Promise<ActionResult<{ updateId: string }>> {
  const user = await requireUser();
  try {
    const d = actionUpdateSchema.parse(input);
    const updateId = await withUser(user.id, async (tx) => {
      const [current] = await tx<{ status: string }[]>`select status from public.corrective_actions where id = ${d.actionId}`;
      if (!current) throw Object.assign(new Error("forbidden"), { code: "42501" });
      const note = d.comment;
      const r = await tx`update public.corrective_actions set status = ${d.status},
          completion_note = case when ${d.status} in ('resolved','verified','closed') then coalesce(${note}, completion_note) else completion_note end,
          verification_note = case when ${d.status} in ('verified','closed') then ${note} else verification_note end
        where id = ${d.actionId}`;
      if (r.count === 0) throw Object.assign(new Error("forbidden"), { code: "42501" });
      const [u] = await tx<{ id: string }[]>`insert into public.action_updates (action_id, comment, status_from, status_to)
        values (${d.actionId}, ${note}, ${current.status}, ${d.status}) returning id`;
      return u.id;
    });
    revalidatePath("/massnahmen");
    return { ok: true, data: { updateId }, message: "Massnahme aktualisiert." };
  } catch (err) {
    return toUserError(err);
  }
}
