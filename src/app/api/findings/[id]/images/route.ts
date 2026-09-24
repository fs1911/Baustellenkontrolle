import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/auth/request";
import { withUser } from "@/lib/db/client";
import { addFindingImage } from "@/lib/services/findings";
import { ImageValidationError, MAX_UPLOAD_BYTES } from "@/lib/services/images";
import { storage } from "@/lib/services/storage";

export async function POST(request: Request, ctx: RouteContext<"/api/findings/[id]/images">) {
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
  const caption =
    String(form.get("caption") ?? "")
      .trim()
      .slice(0, 500) || null;
  if (!(file instanceof File)) return NextResponse.json({ error: "Keine Datei übermittelt." }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "Das Bild ist grösser als 15 MB." }, { status: 413 });
  try {
    const result = await withUser(user.id, async (tx) => {
      const img = await addFindingImage(tx, id, { data: Buffer.from(await file.arrayBuffer()), caption });
      const [row] = await tx<{ thumbnailPath: string }[]>`select thumbnail_path from public.finding_images where id = ${img.id}`;
      return { id: img.id, thumbUrl: await storage().signedUrl("finding-images", row.thumbnailPath) };
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ImageValidationError) return NextResponse.json({ error: err.message }, { status: 400 });
    const code = (err as { code?: string }).code;
    if (code === "42501") return NextResponse.json({ error: "Keine Berechtigung für diese Feststellung." }, { status: 403 });
    console.error(err);
    return NextResponse.json({ error: "Das Bild konnte nicht gespeichert werden." }, { status: 500 });
  }
}
