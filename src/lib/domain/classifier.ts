/**
 * Regelbasierter Klassifikator (KI-Fallback ohne externe Dienste).
 * Liefert Vorschläge inkl. Begründung – nie Entscheidungen.
 */
import type { Assessment, RiskLevel } from "./enums";
import { RISK_LEVELS } from "./enums";
import { containsKeyword, normalizeText } from "./text";

export interface CatalogSubcategory {
  id: string;
  code: string;
  name: string;
  keywords: string[];
  defaultRisk: RiskLevel | null;
  sampleAction: string | null;
}

export interface CatalogCategory {
  id: string;
  code: string;
  name: string;
  keywords: string[];
  defaultRisk: RiskLevel;
  sampleAction: string | null;
  subcategories: CatalogSubcategory[];
  referenceIds: string[];
}

export interface ClassificationInput {
  title: string;
  description?: string | null;
}

export interface ClassificationSuggestion {
  categoryId: string | null;
  categoryName: string | null;
  subcategoryId: string | null;
  subcategoryName: string | null;
  assessment: Assessment | null;
  riskLevel: RiskLevel | null;
  confidence: number; // 0..1
  matchedKeywords: string[];
  suggestedActions: string[];
  referenceIds: string[];
  explanation: string[];
}

const NEGATIVE_CUES = [
  "fehlt", "fehlen", "fehlend", "fehlende", "fehlender", "mangelhaft", "ungenügend", "ungesichert", "defekt",
  "beschädigt", "nicht gesichert", "nicht getragen", "nicht vorhanden", "nicht korrekt", "ohne", "verstellt",
  "blockiert", "abgelaufen", "manipuliert", "unvollständig", "offen", "falsch", "gefahr",
  "lose", "nicht fixiert", "unter schwebend", "unordnung", "herumliegend", "undicht", "tropft",
];
const POSITIVE_CUES = [
  "vorbildlich", "einwandfrei", "sehr gut", "gut organisiert", "sauber", "ordnungsgemäss", "korrekt",
  "vollständig", "konsequent", "gut sichtbar", "positiv", "lobenswert", "beispielhaft",
  "keine mängel", "keine beanstandung", "gut gelöst", "gut umgesetzt", "sauber organisiert",
];
const IMPROVEMENT_CUES = [
  "könnte", "könnten", "empfehlung", "empfohlen", "verbessern", "verbesserung", "optimieren", "optimierung",
  "sollte", "sollten", "wäre", "anregung", "vorschlag", "zweckmässig",
];
const CRITICAL_CUES = [
  "lebensgefahr", "einsturz", "unter schwebend", "unter spannung", "akut", "sofort gestoppt", "arbeiten gestoppt",
  "asbest", "absturzhöhe", "ungesicherte kante",
];
const ESCALATE_CUES = ["sofort", "mehrere", "wiederholt", "erneut", "stark", "gross", "grosse", "hoch"];
const DEESCALATE_CUES = ["geringfügig", "klein", "kleiner", "vereinzelt", "leicht", "punktuell"];

/**
 * Signalwörter werden nur am Wortanfang erkannt ("unvollständig" ≠ "vollständig").
 * Mit negationAware zählt ein Treffer nicht, wenn "nicht"/"kein(e)" direkt davor steht.
 */
function countCues(text: string, cues: string[], negationAware = false): string[] {
  return cues.filter((cue) => {
    const pattern = new RegExp(`(^|\\s)(\\S+\\s)?${cue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "gu");
    for (const m of text.matchAll(pattern)) {
      const prev = (m[2] ?? "").trim();
      if (negationAware && ["nicht", "kein", "keine", "nie", "wenig"].includes(prev)) continue;
      return true;
    }
    return false;
  });
}

function shiftRisk(level: RiskLevel, delta: number): RiskLevel {
  const idx = Math.max(0, Math.min(RISK_LEVELS.length - 1, RISK_LEVELS.indexOf(level) + delta));
  return RISK_LEVELS[idx];
}

/** Erkennt Höhenangaben wie "3 m", "4.5m", "über 2 Meter" im Text. */
function maxHeightMeters(text: string): number | null {
  const matches = Array.from(text.matchAll(/(\d+(?:[.,]\d+)?)\s?(?:m|meter)\b/g));
  if (matches.length === 0) return null;
  return Math.max(...matches.map((m) => Number.parseFloat(m[1].replace(",", "."))));
}

export function classifyFinding(input: ClassificationInput, catalog: CatalogCategory[]): ClassificationSuggestion {
  const text = normalizeText(`${input.title} ${input.description ?? ""}`);
  const explanation: string[] = [];

  let best: { cat: CatalogCategory; sub: CatalogSubcategory | null; score: number; matched: string[] } | null = null;
  for (const cat of catalog) {
    const catMatches = cat.keywords.filter((k) => containsKeyword(text, k));
    let bestSub: { sub: CatalogSubcategory; matches: string[] } | null = null;
    for (const sub of cat.subcategories) {
      const subMatches = sub.keywords.filter((k) => containsKeyword(text, k));
      if (subMatches.length > 0 && (!bestSub || subMatches.length > bestSub.matches.length)) {
        bestSub = { sub, matches: subMatches };
      }
    }
    const score = catMatches.length + (bestSub ? bestSub.matches.length * 2 : 0);
    if (score > 0 && (!best || score > best.score)) {
      best = {
        cat,
        sub: bestSub?.sub ?? null,
        score,
        matched: Array.from(new Set([...catMatches, ...(bestSub?.matches ?? [])])),
      };
    }
  }

  const negative = countCues(text, NEGATIVE_CUES);
  const positive = countCues(text, POSITIVE_CUES, true);
  const improvement = countCues(text, IMPROVEMENT_CUES);
  let assessment: Assessment | null = null;
  if (improvement.length > 0 && improvement.length >= negative.length) {
    assessment = "improvement";
    explanation.push(`Beurteilung «Verbesserungsmöglichkeit», da Formulierungen wie «${improvement.slice(0, 3).join("», «")}» vorkommen.`);
  } else if (negative.length > positive.length) {
    assessment = "negative";
    explanation.push(`Beurteilung «Abweichung», da Hinweise wie «${negative.slice(0, 3).join("», «")}» vorkommen.`);
  } else if (positive.length > 0) {
    assessment = "positive";
    explanation.push(`Beurteilung «Positiv», da Formulierungen wie «${positive.slice(0, 3).join("», «")}» vorkommen.`);
  }

  let riskLevel: RiskLevel | null = null;
  if (best && assessment !== "positive") {
    riskLevel = best.sub?.defaultRisk ?? best.cat.defaultRisk;
    explanation.push(`Ausgangs-Risikostufe gemäss Katalog: ${riskLevel}.`);
    const critical = countCues(text, CRITICAL_CUES);
    const height = maxHeightMeters(text);
    if (critical.length > 0) {
      riskLevel = "critical";
      explanation.push(`Erhöht auf «kritisch» wegen: ${critical.join(", ")}.`);
    } else if (height !== null && height >= 2 && ["absturz", "oeffnungen", "geruest", "graben"].includes(best.cat.code)) {
      riskLevel = shiftRisk(riskLevel, height >= 3 ? 1 : 0);
      if (height >= 3) explanation.push(`Erhöht wegen Höhenangabe von ${height} m.`);
    } else if (countCues(text, ESCALATE_CUES).length > 0) {
      riskLevel = shiftRisk(riskLevel, 1);
      explanation.push("Um eine Stufe erhöht (Hinweise auf Dringlichkeit oder Häufung).");
    } else if (countCues(text, DEESCALATE_CUES).length > 0) {
      riskLevel = shiftRisk(riskLevel, -1);
      explanation.push("Um eine Stufe gesenkt (Hinweise auf geringes Ausmass).");
    }
    if (assessment === "improvement" && (riskLevel === "critical" || riskLevel === "high")) {
      riskLevel = "medium";
    }
  }

  if (best) {
    explanation.unshift(
      `Kategorie «${best.cat.name}»${best.sub ? ` / «${best.sub.name}»` : ""} aufgrund der Schlagworte: ${best.matched.join(", ")}.`,
    );
  } else {
    explanation.unshift("Keine eindeutigen Schlagworte gefunden – bitte Kategorie manuell wählen.");
  }

  const maxScore = 6;
  const confidence = best ? Math.min(1, best.score / maxScore) * (assessment ? 1 : 0.8) : 0;
  const suggestedActions = Array.from(
    new Set([best?.sub?.sampleAction, best?.cat.sampleAction].filter((x): x is string => !!x)),
  );

  return {
    categoryId: best?.cat.id ?? null,
    categoryName: best?.cat.name ?? null,
    subcategoryId: best?.sub?.id ?? null,
    subcategoryName: best?.sub?.name ?? null,
    assessment,
    riskLevel,
    confidence: Math.round(confidence * 100) / 100,
    matchedKeywords: best?.matched ?? [],
    suggestedActions: assessment === "positive" ? [] : suggestedActions,
    referenceIds: best?.cat.referenceIds ?? [],
    explanation,
  };
}

export interface DraftForCompleteness {
  assessment: Assessment | null;
  riskLevel: RiskLevel | null;
  categoryId: string | null;
  responsibleRole: string | null;
  dueDate: string | null;
  actionDescription: string | null;
  description: string | null;
  imageCount: number;
}

/** Hinweise auf fehlende Angaben (keine Blockade, ausser wo die DB es verlangt). */
export function completenessHints(d: DraftForCompleteness): { level: "error" | "warning"; message: string }[] {
  const hints: { level: "error" | "warning"; message: string }[] = [];
  if (d.assessment === "positive") return hints;
  const severe = d.riskLevel === "high" || d.riskLevel === "critical";
  if (d.assessment === "negative" && d.riskLevel === "critical") {
    if (!d.categoryId) hints.push({ level: "error", message: "Kritische Abweichung: Kategorie ist erforderlich." });
    if (!d.responsibleRole?.trim()) hints.push({ level: "error", message: "Kritische Abweichung: verantwortliche Rolle ist erforderlich." });
  }
  if (!d.actionDescription?.trim()) hints.push({ level: severe ? "error" : "warning", message: "Es ist keine Massnahme erfasst." });
  if (!d.dueDate && severe) hints.push({ level: "warning", message: "Bei hoher oder kritischer Abweichung sollte eine Frist gesetzt werden." });
  if (!d.responsibleRole?.trim() && d.riskLevel !== "critical") hints.push({ level: "warning", message: "Keine verantwortliche Rolle bzw. Person angegeben." });
  if (d.imageCount === 0 && d.assessment === "negative") hints.push({ level: "warning", message: "Kein Foto vorhanden – ein Bild erleichtert die Umsetzung." });
  if (!d.description?.trim() || d.description.trim().length < 15) hints.push({ level: "warning", message: "Die Beschreibung ist sehr kurz." });
  return hints;
}
