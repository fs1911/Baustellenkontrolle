/** E-Mail-Vorlage und Empfängerprüfung für den Berichtsversand. */
import { z } from "zod";

export const emailAddress = z.string().trim().toLowerCase().email("Ungültige E-Mail-Adresse").max(254);

export function parseAddressList(input: string | string[] | null | undefined): { valid: string[]; invalid: string[] } {
  const raw = Array.isArray(input) ? input : (input ?? "").split(/[,;\s]+/);
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const item of raw.map((s) => s.trim()).filter(Boolean)) {
    const r = emailAddress.safeParse(item);
    if (r.success) {
      if (!valid.includes(r.data)) valid.push(r.data);
    } else invalid.push(item);
  }
  return { valid, invalid };
}

export interface RecipientPolicyInput {
  to: string[];
  cc: string[];
  bcc: string[];
  senderEmail: string;
  companyDistribution: string[];
  siteMemberEmails: string[];
  mayUseArbitraryRecipients: boolean;
}

/**
 * Projektleitende dürfen an sich selbst, den Standardverteiler der Gesellschaft und an Personen mit Zugriff
 * auf die Baustelle senden. Freie Empfänger (inkl. externer Adressen, CC/BCC) nur Admin und Gruppen-IMS/SIBE.
 */
export function checkRecipientPolicy(p: RecipientPolicyInput): string[] {
  const errors: string[] = [];
  const all = [...p.to, ...p.cc, ...p.bcc];
  if (p.to.length === 0) errors.push("Mindestens ein Empfänger ist erforderlich.");
  if (all.length > 50) errors.push("Maximal 50 Empfänger sind zulässig.");
  if (!p.mayUseArbitraryRecipients) {
    const allowed = new Set([p.senderEmail, ...p.companyDistribution, ...p.siteMemberEmails].map((e) => e.toLowerCase()));
    const notAllowed = all.filter((a) => !allowed.has(a.toLowerCase()));
    if (notAllowed.length > 0) {
      errors.push(
        `Keine Berechtigung für freie Empfänger: ${notAllowed.join(", ")}. Erlaubt sind die eigene Adresse, der Standardverteiler und Beteiligte der Baustelle.`,
      );
    }
  }
  return errors;
}

export interface ReportMailContext {
  companyName: string;
  siteName: string;
  siteNumber: string | null;
  inspectionDate: string; // bereits formatiert (TT.MM.JJJJ)
  reportNumber: string;
  senderName: string;
  summary: string;
  positives: number;
  deviations: number;
  improvements: number;
  openActions: number;
  criticalOrHigh: number;
}

export function defaultSubject(c: ReportMailContext): string {
  return `Baustellenkontrollbericht – ${c.companyName} – ${c.siteName} – ${c.inspectionDate}`;
}

export function defaultBody(c: ReportMailContext): string {
  return [
    "Guten Tag",
    "",
    `Im Anhang erhalten Sie den Baustellenkontrollbericht ${c.reportNumber} der ${c.companyName} für die Baustelle «${c.siteName}»${c.siteNumber ? ` (${c.siteNumber})` : ""} vom ${c.inspectionDate}.`,
    "",
    "Kurzübersicht:",
    `– Positive Feststellungen: ${c.positives}`,
    `– Abweichungen: ${c.deviations}`,
    `– Verbesserungsmöglichkeiten: ${c.improvements}`,
    `– Hohe oder kritische Risiken: ${c.criticalOrHigh}`,
    `– Offene Massnahmen: ${c.openActions}`,
    "",
    c.summary.trim(),
    "",
    "Wir bitten die Verantwortlichen, die aufgeführten Massnahmen fristgerecht umzusetzen und die Umsetzung zu dokumentieren.",
    "",
    "Freundliche Grüsse",
    c.senderName,
    c.companyName,
  ].join("\n");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Wandelt den (bearbeitbaren) Klartext in eine schlichte, professionelle HTML-Mail um. Benutzereingaben werden escaped. */
export function bodyToHtml(body: string, opts: { companyName: string; primaryColor: string | null; disclaimer: string }): string {
  const color = opts.primaryColor && /^#[0-9a-f]{6}$/i.test(opts.primaryColor) ? opts.primaryColor : "#1f2937";
  const paragraphs = escapeHtml(body)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px 0;">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<!doctype html><html lang="de-CH"><body style="margin:0;padding:0;background:#f3f4f6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:6px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#111827;font-size:14px;line-height:1.5;">
<tr><td style="background:${color};color:#ffffff;padding:16px 24px;font-size:16px;font-weight:bold;">${escapeHtml(opts.companyName)} – Baustellenkontrollbericht</td></tr>
<tr><td style="padding:24px;">${paragraphs}</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;">${escapeHtml(opts.disclaimer)}</td></tr>
</table></td></tr></table></body></html>`;
}
