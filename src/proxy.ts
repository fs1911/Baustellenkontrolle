import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistische Weiterleitung nicht angemeldeter Benutzer zur Anmeldung.
 * Die eigentliche Prüfung (Sitzung, Rollen, RLS) erfolgt serverseitig in jeder Seite/Aktion.
 */
const PUBLIC_PREFIXES = ["/login", "/auth/", "/datenschutz", "/offline", "/api/files/", "/api/jobs/", "/design-system"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();
  const hasSession =
    request.cookies.has("bk_session") || request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
  if (!hasSession) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icons/|manifest.webmanifest|sw.js|favicon.ico|robots.txt).*)"],
};
