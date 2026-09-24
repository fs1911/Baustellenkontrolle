import "server-only";
import { env } from "@/lib/env";

/** CSRF-Schutz für Route Handler mit Cookies: Origin muss zur App gehören. Server Actions prüfen dies bereits selbst. */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return; // gleiche Herkunft bei Navigationsanfragen ohne Origin-Header (GET) – POST von Browsern sendet Origin
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const allowed = new Set([new URL(env().APP_BASE_URL).host, host].filter(Boolean));
  if (!allowed.has(new URL(origin).host)) {
    throw new Response("Ungültige Herkunft der Anfrage", { status: 403 });
  }
}
