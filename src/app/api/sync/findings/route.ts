import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/auth/request";
import { withUser } from "@/lib/db/client";
import { findingSchema } from "@/lib/domain/validation";
import { addFindingImage, saveFinding } from "@/lib/services/findings";
import { ImageValidationError } from "@/lib/services/images";
import { toUserError } from "@/lib/utils/errors";

/** Idempotente Übernahme offline erfasster Feststellungen inkl. Fotos (client_ref). */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch (res) {
    return res as Response;
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const form = await request.formData();
  const clientRef = z.string().uuid().safeParse(form.get("clientRef"));
  if (!clientRef.success) return NextResponse.json({ error: "Ungültige Referenz" }, { status: 400 });
  let payload: unknown;
  try {
    payload = JSON.parse(String(form.get("payload") ?? "{}"));
  } catch {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }
  const parsed = findingSchema.safeParse({ ...(payload as object), inspectionId: form.get("inspectionId"), status: null });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 422 });
  }
  const images = form.getAll("images").filter((f): f is File => f instanceof File);
  const imageIds = form.getAll("imageIds").map(String);
  const captions = form.getAll("captions").map(String);
  try {
    const id = await withUser(user.id, async (tx) => {
      const findingId = await saveFinding(tx, parsed.data, { clientRef: clientRef.data });
      for (let i = 0; i < images.length; i++) {
        const ref = z.string().uuid().safeParse(imageIds[i]);
        await addFindingImage(tx, findingId, {
          data: Buffer.from(await images[i].arrayBuffer()),
          caption: captions[i] || null,
          clientRef: ref.success ? ref.data : null,
        });
      }
      return findingId;
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    if (err instanceof ImageValidationError) return NextResponse.json({ error: err.message }, { status: 422 });
    const e = toUserError(err);
    return NextResponse.json({ error: e.error }, { status: (err as { code?: string }).code === "42501" ? 403 : 422 });
  }
}
