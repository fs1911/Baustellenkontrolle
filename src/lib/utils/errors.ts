import "server-only";
import { ZodError } from "zod";

export type ActionResult<T = undefined> =
  { ok: true; data: T; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Übersetzt technische Fehler in verständliche Meldungen (ohne interne Details preiszugeben). */
export function toUserError(err: unknown): { ok: false; error: string; fieldErrors?: Record<string, string> } {
  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: "Bitte die markierten Angaben prüfen.", fieldErrors };
  }
  const e = err as { code?: string; message?: string; constraint_name?: string };
  switch (e?.code) {
    case "42501":
      if (e.message && /vorbehalten|Berechtigung/.test(e.message)) return { ok: false, error: e.message };
      return { ok: false, error: "Für diese Aktion fehlt die Berechtigung." };
    case "23514":
      if (e.constraint_name === "findings_critical_check")
        return { ok: false, error: "Kritische Abweichungen benötigen Kategorie, verantwortliche Rolle und Massnahmenstatus." };
      if (e.constraint_name === "findings_closed_check")
        return { ok: false, error: "Zum Schliessen ist eine Abschluss- bzw. Verifikationsinformation erforderlich." };
      if (e.constraint_name === "corrective_actions_verified_check")
        return { ok: false, error: "Für Verifikation oder Abschluss ist eine Bemerkung erforderlich." };
      return { ok: false, error: e.message && !e.message.includes("violates") ? e.message : "Die Angaben verletzen eine fachliche Regel." };
    case "23505":
      return { ok: false, error: "Ein Eintrag mit diesen Angaben existiert bereits." };
    case "23503":
      return { ok: false, error: "Ein verknüpfter Eintrag wurde nicht gefunden." };
  }
  if (err instanceof Error && err.name === "ForbiddenError") return { ok: false, error: err.message };
  console.error(err);
  return { ok: false, error: "Die Aktion konnte nicht ausgeführt werden. Bitte erneut versuchen." };
}
