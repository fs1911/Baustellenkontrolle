import "server-only";
import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { env } from "@/lib/env";
import { classifyFinding, type CatalogCategory, type ClassificationInput, type ClassificationSuggestion } from "@/lib/domain/classifier";
import { ASSESSMENTS, RISK_LEVELS } from "@/lib/domain/enums";
import type { AllSettings } from "@/lib/domain/settings";
import { buildRuleSummary, type SummaryInput } from "@/lib/domain/summary";

/**
 * KI-Schicht mit austauschbarem Provider.
 *  - "rules": lokaler, regelbasierter Fallback (Standard, keine Datenübermittlung).
 *  - "anthropic": Claude über das offizielle SDK – nur wenn AI_PROVIDER=anthropic, ein API-Key gesetzt
 *    UND in den Einstellungen die externe Verarbeitung freigegeben ist.
 * Fehler des externen Dienstes führen nie zum Abbruch: es wird auf die Regeln zurückgefallen.
 */

export interface AiResult<T> {
  value: T;
  provider: string;
  model: string | null;
  inputHash: string;
  fallbackReason?: string;
}

const DEFAULT_MODEL = "claude-opus-5";

export function externalAiActive(settings: AllSettings): boolean {
  const e = env();
  return e.AI_PROVIDER === "anthropic" && !!e.ANTHROPIC_API_KEY && settings.ai.allowExternal;
}

export function describeAiMode(settings: AllSettings): string {
  if (externalAiActive(settings)) return `Externer KI-Dienst (Anthropic, Modell ${env().AI_MODEL ?? DEFAULT_MODEL})`;
  if (env().AI_PROVIDER === "anthropic" && !settings.ai.allowExternal)
    return "Regelbasiert (externe KI in den Einstellungen nicht freigegeben)";
  return "Regelbasiert (lokal, ohne Datenübermittlung)";
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 32);
}

let client: Anthropic | undefined;
function anthropic(): Anthropic {
  client ??= new Anthropic({ apiKey: env().ANTHROPIC_API_KEY, timeout: 30_000, maxRetries: 1 });
  return client;
}

const classificationOutput = z.object({
  category_code: z.string().nullable(),
  subcategory_code: z.string().nullable(),
  assessment: z.enum(ASSESSMENTS).nullable(),
  risk_level: z.enum(RISK_LEVELS).nullable(),
  suggested_actions: z.array(z.string()).max(3),
  rationale: z.array(z.string()).max(5),
});

export async function suggestClassification(
  input: ClassificationInput & { images?: { mediaType: "image/jpeg"; base64: string }[] },
  catalog: CatalogCategory[],
  settings: AllSettings,
): Promise<AiResult<ClassificationSuggestion>> {
  const ruleResult = classifyFinding(input, catalog);
  const inputHash = hash({ t: input.title, d: input.description });
  if (!externalAiActive(settings)) {
    return { value: ruleResult, provider: "rules", model: null, inputHash };
  }
  const model = env().AI_MODEL ?? DEFAULT_MODEL;
  try {
    const catalogText = catalog
      .map((c) => `${c.code}: ${c.name}\n${c.subcategories.map((s) => `  - ${s.code}: ${s.name}`).join("\n")}`)
      .join("\n");
    const content: Anthropic.ContentBlockParam[] = [];
    if (settings.ai.allowImages && input.images?.length) {
      for (const img of input.images.slice(0, 2)) {
        content.push({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.base64 } });
      }
    }
    content.push({
      type: "text",
      text: `Feststellung einer Baustellenkontrolle (Schweiz):\nTitel: ${input.title}\nBeschreibung: ${input.description ?? "–"}`,
    });
    const response = await anthropic().messages.parse({
      model,
      max_tokens: 2000,
      output_config: { effort: "low", format: zodOutputFormat(classificationOutput) },
      system: `Du unterstützt SIBE und Bauleitende bei der Klassifikation von Feststellungen aus Baustellenkontrollen in der Schweiz.
Wähle Kategorie und Unterkategorie ausschliesslich aus diesem Katalog (Codes verwenden), sonst null:
${catalogText}
Beurteilung: positive, negative (Abweichung) oder improvement (Verbesserungsmöglichkeit). Risikostufe nur bei negative/improvement.
Massnahmenvorschläge: sachlich, präventiv, in Schweizer Hochdeutsch (kein ß), ohne rechtliche Bewertungen und ohne Schuldzuweisungen an Personen.
Erfinde keine Fakten, die nicht in der Feststellung stehen.`,
      messages: [{ role: "user", content }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return { value: ruleResult, provider: "rules", model: null, inputHash, fallbackReason: "Keine verwertbare Antwort des KI-Dienstes" };
    }
    const out = response.parsed_output;
    const cat = catalog.find((c) => c.code === out.category_code) ?? null;
    const sub = cat?.subcategories.find((s) => s.code === out.subcategory_code) ?? null;
    if (!cat) {
      return { value: ruleResult, provider: "rules", model: null, inputHash, fallbackReason: "KI-Dienst lieferte keine gültige Kategorie" };
    }
    return {
      value: {
        categoryId: cat.id,
        categoryName: cat.name,
        subcategoryId: sub?.id ?? null,
        subcategoryName: sub?.name ?? null,
        assessment: out.assessment,
        riskLevel: out.assessment === "positive" ? null : out.risk_level,
        confidence: 0.8,
        matchedKeywords: ruleResult.matchedKeywords,
        suggestedActions: out.assessment === "positive" ? [] : out.suggested_actions,
        referenceIds: cat.referenceIds,
        explanation: [`Vorschlag des KI-Dienstes (${model}).`, ...out.rationale],
      },
      provider: "anthropic",
      model,
      inputHash,
    };
  } catch (err) {
    const reason =
      err instanceof Anthropic.APIError ? `KI-Dienst nicht verfügbar (${err.status ?? "Netzwerk"})` : "KI-Dienst nicht verfügbar";
    return { value: ruleResult, provider: "rules", model: null, inputHash, fallbackReason: reason };
  }
}

/** Management Summary: basiert ausschliesslich auf den übergebenen, gespeicherten Kontrolldaten. */
export async function suggestSummary(input: SummaryInput, settings: AllSettings): Promise<AiResult<string>> {
  const ruleText = buildRuleSummary(input);
  const inputHash = hash(input);
  if (!externalAiActive(settings)) return { value: ruleText, provider: "rules", model: null, inputHash };
  const model = env().AI_MODEL ?? DEFAULT_MODEL;
  try {
    const response = await anthropic().messages.create({
      model,
      max_tokens: 4000,
      output_config: { effort: "low" },
      system: `Du formulierst die Management Summary eines Baustellenkontrollberichts in professionellem Schweizer Hochdeutsch (kein ß).
Regeln: Verwende ausschliesslich die gelieferten Daten, erfinde nichts. Keine rechtlich verbindlichen Bewertungen, keine Vorwürfe an Personen.
Tonalität: sachlich, präventiv, lösungsorientiert, konstruktiv. Länge: 4–7 Sätze, Fliesstext ohne Aufzählungszeichen.`,
      messages: [{ role: "user", content: `Kontrolldaten (JSON):\n${JSON.stringify(input)}` }],
    });
    if (response.stop_reason === "refusal") {
      return { value: ruleText, provider: "rules", model: null, inputHash, fallbackReason: "KI-Dienst hat die Anfrage abgelehnt" };
    }
    const text = response.content
      .flatMap((b) => (b.type === "text" ? [b.text] : []))
      .join("\n")
      .trim();
    if (!text) return { value: ruleText, provider: "rules", model: null, inputHash, fallbackReason: "Leere Antwort" };
    return { value: text.replace(/ß/g, "ss"), provider: "anthropic", model, inputHash };
  } catch (err) {
    const reason =
      err instanceof Anthropic.APIError ? `KI-Dienst nicht verfügbar (${err.status ?? "Netzwerk"})` : "KI-Dienst nicht verfügbar";
    return { value: ruleText, provider: "rules", model: null, inputHash, fallbackReason: reason };
  }
}
