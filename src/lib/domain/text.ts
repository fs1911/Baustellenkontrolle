/** Textnormalisierung und erklärbare Ähnlichkeitsmasse (ohne externe Dienste). */

const STOPWORDS = new Set([
  "der", "die", "das", "und", "oder", "ein", "eine", "einer", "eines", "einem", "einen", "ist", "sind", "war",
  "wurde", "wurden", "im", "in", "am", "an", "auf", "bei", "mit", "von", "vom", "zu", "zum", "zur", "für",
  "den", "dem", "des", "es", "sich", "als", "auch", "noch", "nur", "so", "wie", "hat", "haben", "wird",
  "werden", "bereich", "baustelle",
]);

export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/[^\p{L}\p{N}\s.,]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(input: string): string[] {
  return normalizeText(input)
    .split(/[\s.-]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

function trigrams(input: string): Map<string, number> {
  const grams = new Map<string, number>();
  for (const token of tokenize(input)) {
    const padded = `  ${token} `;
    for (let i = 0; i < padded.length - 2; i++) {
      const g = padded.slice(i, i + 3);
      grams.set(g, (grams.get(g) ?? 0) + 1);
    }
  }
  return grams;
}

/**
 * Dice-Koeffizient über Zeichen-Trigramme (0..1). Robust gegenüber deutschen Komposita und
 * Flexionen ("Seitenschutz" ~ "Seitenschutzes"), vergleichbar mit pg_trgm in der Datenbank.
 */
export function textSimilarity(a: string, b: string): number {
  const ga = trigrams(a);
  const gb = trigrams(b);
  if (ga.size === 0 || gb.size === 0) return 0;
  let overlap = 0;
  let totalA = 0;
  let totalB = 0;
  for (const [, n] of ga) totalA += n;
  for (const [, n] of gb) totalB += n;
  for (const [g, n] of ga) {
    const m = gb.get(g);
    if (m) overlap += Math.min(n, m);
  }
  return (2 * overlap) / (totalA + totalB);
}

/** Prüft, ob ein Schlagwort im Text vorkommt (Mehrwortbegriffe als Teilstring, Einzelwörter als Wortanfang/Kompositum). */
export function containsKeyword(normalizedText: string, keyword: string): boolean {
  const k = normalizeText(keyword);
  if (!k) return false;
  if (k.includes(" ")) return normalizedText.includes(k);
  // Kurze Begriffe ("FI", "Öl") nur als ganzes Wort, mittellange als Wortanfang ("Last" ≠ "Belastung"),
  // lange auch innerhalb von Komposita ("Absturzsicherung" enthält "Absturz").
  if (k.length <= 3) return new RegExp(`(^|\\s)${escapeRegExp(k)}(\\s|$)`, "u").test(normalizedText);
  if (k.length <= 5) return new RegExp(`(^|\\s)${escapeRegExp(k)}`, "u").test(normalizedText);
  return normalizedText.includes(k);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
