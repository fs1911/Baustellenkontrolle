import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/auth/request";
import { withUser } from "@/lib/db/client";
import { loadClassifierCatalog } from "@/lib/repositories/catalog";
import { loadSettings } from "@/lib/repositories/settings";
import { describeAiMode, suggestClassification } from "@/lib/services/ai";

const bodySchema = z.object({
  inspectionId: z.string().uuid(),
  title: z.string().trim().min(3).max(200),
  description: z.string().max(4000).optional().nullable(),
});

/** KI-Vorschlag für Kategorie, Beurteilung, Risiko, Massnahmen und Referenzen (immer als Vorschlag gespeichert). */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch (res) {
    return res as Response;
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bitte zuerst einen Titel erfassen." }, { status: 400 });
  const input = parsed.data;
  try {
    const out = await withUser(user.id, async (tx) => {
      const [insp] = await tx<{ id: string }[]>`select id from public.inspections where id = ${input.inspectionId} and site_id = any(${user.permissions.edit_site_ids}::uuid[])`;
      if (!insp) return null;
      const [catalog, settings] = await Promise.all([loadClassifierCatalog(tx), loadSettings(tx)]);
      const result = await suggestClassification({ title: input.title, description: input.description }, catalog, settings);
      const [row] = await tx<{ id: string }[]>`
        insert into public.ai_suggestions (inspection_id, kind, provider, model, input_hash, suggestion, explanation)
        values (${input.inspectionId}, 'classification', ${result.provider}, ${result.model}, ${result.inputHash},
                ${tx.json(result.value as never)}, ${result.value.explanation.join(" ")}) returning id`;
      const refs = result.value.referenceIds.length
        ? await tx<{ id: string; code: string; title: string; reviewStatus: string }[]>`
            select id, code, title, review_status from public.legal_references where id = any(${result.value.referenceIds}::uuid[])`
        : [];
      return { suggestionId: row.id, suggestion: result.value, provider: result.provider, mode: describeAiMode(settings), fallbackReason: result.fallbackReason ?? null, references: refs };
    });
    if (!out) return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
    return NextResponse.json(out);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Vorschläge sind momentan nicht verfügbar." }, { status: 500 });
  }
}
