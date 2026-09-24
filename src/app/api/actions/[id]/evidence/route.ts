import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/auth/request";
import { withUser } from "@/lib/db/client";
import { ImageValidationError, processPhoto } from "@/lib/services/images";
import { loadSettings } from "@/lib/repositories/settings";
import { storage } from "@/lib/services/storage";

/** Abschlussnachweis (Foto) zu einer Massnahme – auch für Poliere auf zugewiesenen Baustellen. */
export async function POST(request: Request, ctx: RouteContext<"/api/actions/[id]/evidence">) {
  try {
    assertSameOrigin(request);
  } catch (res) {
    return res as Response;
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const { id } = await ctx.params;
  const form = await request.formData();
  const file = form.get("file");
  const comment = String(form.get("comment") ?? "").trim().slice(0, 2000) || "Abschlussnachweis hochgeladen";
  if (!(file instanceof File)) return NextResponse.json({ error: "Keine Datei übermittelt." }, { status: 400 });
  try {
    await withUser(user.id, async (tx) => {
      const [a] = await tx<{ companyId: string; siteId: string; status: string }[]>`select company_id, site_id, status from public.corrective_actions where id = ${id}`;
      if (!a) throw Object.assign(new Error("forbidden"), { code: "42501" });
      const settings = await loadSettings(tx);
      const img = await processPhoto(Buffer.from(await file.arrayBuffer()), { stripMetadata: settings.images.stripMetadata });
      const [u] = await tx<{ id: string }[]>`insert into public.action_updates (action_id, comment, status_from, status_to)
        values (${id}, ${comment}, ${a.status}, ${a.status}) returning id`;
      const path = `${a.companyId}/${a.siteId}/actions/${id}/${randomUUID()}.jpg`;
      await tx`insert into public.attachments (company_id, site_id, entity_type, entity_id, bucket, storage_path, file_name, mime_type, size_bytes)
        values (${a.companyId}, ${a.siteId}, 'action_update', ${u.id}, 'attachments', ${path}, ${file.name.slice(0, 200) || "nachweis.jpg"}, 'image/jpeg', ${img.data.byteLength})`;
      await storage().put("attachments", path, img.data, "image/jpeg");
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    if (err instanceof ImageValidationError) return NextResponse.json({ error: err.message }, { status: 400 });
    if ((err as { code?: string }).code === "42501") return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
    console.error(err);
    return NextResponse.json({ error: "Nachweis konnte nicht gespeichert werden." }, { status: 500 });
  }
}
