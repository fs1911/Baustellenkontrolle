import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/auth/request";
import { withUser } from "@/lib/db/client";
import { ImageValidationError, processLogo } from "@/lib/services/images";
import { storage } from "@/lib/services/storage";

/** Logo-Upload (nur Admin). SVG wird gerastert, damit nie aktive Inhalte ausgeliefert werden. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch (res) {
    return res as Response;
  }
  const user = await getCurrentUser();
  if (!user?.permissions.is_admin) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  const form = await request.formData();
  const companyId = String(form.get("companyId") ?? "");
  const file = form.get("file");
  if (!/^[0-9a-f-]{36}$/i.test(companyId) || !(file instanceof File)) return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  try {
    const logo = await processLogo(Buffer.from(await file.arrayBuffer()));
    const path = `${companyId}/logo-${randomUUID()}.png`;
    await storage().put("company-logos", path, logo.data, "image/png");
    await withUser(user.id, async (tx) => {
      await tx`update public.company_logos set is_active = false where company_id = ${companyId} and is_active`;
      await tx`insert into public.company_logos (company_id, storage_path, mime_type, width, height) values (${companyId}, ${path}, 'image/png', ${logo.width}, ${logo.height})`;
    });
    return NextResponse.json({ ok: true, url: await storage().signedUrl("company-logos", path) });
  } catch (err) {
    if (err instanceof ImageValidationError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error(err);
    return NextResponse.json({ error: "Logo konnte nicht gespeichert werden." }, { status: 500 });
  }
}
