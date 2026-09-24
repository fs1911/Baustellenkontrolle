import { verifyFileToken, storage } from "@/lib/services/storage";

/**
 * Auslieferung lokal gespeicherter Dateien über kurzlebige, signierte Token (STORAGE_PROVIDER=local).
 * Tokens werden nur nach RLS-geprüften Datenbankabfragen ausgestellt.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/files/[token]">) {
  const { token } = await ctx.params;
  const payload = await verifyFileToken(token);
  if (!payload) return new Response("Link ungültig oder abgelaufen.", { status: 403 });
  try {
    const data = await storage().get(payload.bucket, payload.path);
    const type = payload.path.endsWith(".pdf") ? "application/pdf" : payload.path.endsWith(".png") ? "image/png" : "image/jpeg";
    const headers = new Headers({
      "Content-Type": type,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
    });
    if (payload.downloadName) {
      headers.set("Content-Disposition", `attachment; filename="${payload.downloadName.replace(/[^\w.\-]/g, "_")}"`);
    }
    return new Response(new Uint8Array(data), { headers });
  } catch {
    return new Response("Datei nicht gefunden.", { status: 404 });
  }
}
