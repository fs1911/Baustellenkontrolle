import { NextResponse } from "next/server";
import { configIssues } from "@/lib/env";
import { dbRoute, withService } from "@/lib/db/client";

/**
 * Diagnose für den Betrieb (z. B. nach einem Deploy): meldet fehlende oder ungültige Einstellungen
 * und ob die Datenbank erreichbar ist. Gibt nie Werte von Einstellungen oder Secrets aus.
 */
export async function GET() {
  const issues = configIssues();
  let database: string;
  if (issues.length > 0) {
    database = "nicht geprüft (Konfiguration unvollständig)";
  } else {
    try {
      const [row] = await withService((tx) => tx<{ users: number }[]>`select count(*)::int as users from public.user_profiles`);
      database = `ok (${row.users} Benutzer)`;
    } catch (err) {
      // Fehlermeldung ohne Verbindungszeichenfolge (enthält kein Passwort).
      database = `Fehler: ${String((err as Error).message ?? err)
        .replace(/postgres(ql)?:\/\/\S+/g, "[verbindung]")
        .slice(0, 300)}`;
    }
  }
  return NextResponse.json(
    {
      status: issues.length === 0 && database.startsWith("ok") ? "ok" : "fehler",
      konfiguration: issues.length === 0 ? "vollständig" : issues,
      verbindung: await dbRoute(),
      datenbank: database,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
