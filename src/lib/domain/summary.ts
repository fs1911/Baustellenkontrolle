/** Regelbasierte Management Summary – rein faktenbasiert aus den gespeicherten Kontrolldaten. */

export interface SummaryInput {
  companyName: string;
  siteName: string;
  inspectionType: string;
  inspectionDate: string;
  counts: {
    total: number;
    positive: number;
    negative: number;
    improvement: number;
    criticalOrHigh: number;
    openActions: number;
    recurring: number;
  };
  topCategories: { name: string; count: number }[];
  criticalItems: { title: string; category: string | null; risk: string }[];
  positiveHighlights: string[];
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function buildRuleSummary(s: SummaryInput): string {
  const parts: string[] = [];
  parts.push(
    `Anlässlich der Kontrolle vom ${s.inspectionDate} (${s.inspectionType}) auf der Baustelle «${s.siteName}» ${s.counts.total === 1 ? "wurde" : "wurden"} ${plural(s.counts.total, "Feststellung", "Feststellungen")} dokumentiert: ${plural(s.counts.positive, "positive Feststellung", "positive Feststellungen")}, ${plural(s.counts.negative, "Abweichung", "Abweichungen")} und ${plural(s.counts.improvement, "Verbesserungsmöglichkeit", "Verbesserungsmöglichkeiten")}.`,
  );
  if (s.counts.criticalOrHigh > 0) {
    const items = s.criticalItems
      .slice(0, 3)
      .map((c) => `«${c.title}»`)
      .join(", ");
    parts.push(
      `${plural(s.counts.criticalOrHigh, "Feststellung weist", "Feststellungen weisen")} eine hohe oder kritische Risikostufe auf${items ? ` (u. a. ${items})` : ""}; diese sind prioritär zu behandeln.`,
    );
  } else if (s.counts.negative > 0) {
    parts.push("Es wurden keine Abweichungen mit hoher oder kritischer Risikostufe festgestellt.");
  }
  if (s.topCategories.length > 0) {
    parts.push(
      `Schwerpunkte der Abweichungen: ${s.topCategories
        .slice(0, 3)
        .map((c) => `${c.name} (${c.count})`)
        .join(", ")}.`,
    );
  }
  if (s.counts.recurring > 0) {
    parts.push(
      `${plural(s.counts.recurring, "Feststellung ist", "Feststellungen sind")} als wiederkehrend erkannt worden; eine Ursachenanalyse und eine gezielte Instruktion werden empfohlen.`,
    );
  }
  if (s.counts.openActions > 0) {
    parts.push(`Aktuell sind ${plural(s.counts.openActions, "Massnahme", "Massnahmen")} offen oder in Bearbeitung.`);
  } else if (s.counts.negative + s.counts.improvement > 0) {
    parts.push("Alle Massnahmen sind umgesetzt oder abgeschlossen.");
  }
  if (s.positiveHighlights.length > 0) {
    parts.push(
      `Positiv hervorzuheben: ${s.positiveHighlights
        .slice(0, 2)
        .map((p) => `«${p}»`)
        .join(" und ")}.`,
    );
  }
  return parts.join(" ");
}
