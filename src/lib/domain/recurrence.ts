/**
 * Wiederkehrende Abweichungen – transparentes, konfigurierbares Punktemodell.
 *
 * Grundsätze:
 *  - Jeder Punkt ist einem benannten Kriterium mit Begründung zugeordnet (keine Black Box).
 *  - Aussagen beziehen sich auf Baustellen, Gesellschaften, Kategorien und Rollen – nie auf Einzelpersonen.
 *  - Ergebnis ist eine datenbasierte Unterstützung für Prävention und Verbesserung, keine Bewertung.
 */
import { z } from "zod";
import type { ActionStatus, Assessment, RiskLevel } from "./enums";
import { textSimilarity } from "./text";

export const scoringConfigSchema = z.object({
  windowDays: z.number().int().min(7).max(730).default(90),
  sameSubcategory: z.number().min(0).max(20).default(3),
  similarText: z.number().min(0).max(20).default(2),
  sameSite: z.number().min(0).max(20).default(2),
  sameProject: z.number().min(0).max(20).default(0),
  sameCompany: z.number().min(0).max(20).default(0),
  sameTrade: z.number().min(0).max(20).default(1),
  sameResponsibleRole: z.number().min(0).max(20).default(2),
  highRisk: z.number().min(0).max(20).default(3),
  overdueAction: z.number().min(0).max(20).default(2),
  perAdditional: z.number().min(0).max(10).default(1),
  maxAdditional: z.number().int().min(0).max(50).default(10),
  similarityThreshold: z.number().min(0.1).max(0.95).default(0.35),
  minClusterSize: z.number().int().min(2).max(20).default(2),
  highPriorityScore: z.number().min(1).max(100).default(12),
  mediumPriorityScore: z.number().min(1).max(100).default(7),
});
export type ScoringConfig = z.infer<typeof scoringConfigSchema>;
export const DEFAULT_SCORING_CONFIG: ScoringConfig = scoringConfigSchema.parse({});

export interface AnalysisFinding {
  id: string;
  companyId: string;
  companyName: string;
  siteId: string;
  siteName: string;
  projectId: string | null;
  categoryId: string | null;
  categoryName: string | null;
  subcategoryId: string | null;
  subcategoryName: string | null;
  assessment: Assessment;
  riskLevel: RiskLevel | null;
  responsibleRole: string | null;
  trade: string | null;
  title: string;
  description: string | null;
  status: ActionStatus | null;
  createdAt: Date;
  /** Mindestens eine offene Massnahme mit überschrittener Frist */
  overdue: boolean;
  /** Massnahme erst nach Frist erledigt */
  completedLate: boolean;
}

export interface ScoreItem {
  criterion: string;
  label: string;
  points: number;
  detail: string;
}

export interface ScoreResult {
  score: number;
  priority: "high" | "medium" | "low";
  items: ScoreItem[];
  relatedIds: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function isDeviation(f: AnalysisFinding): boolean {
  return f.assessment === "negative" || f.assessment === "improvement";
}

function norm(s: string | null): string {
  return (s ?? "").trim().toLowerCase();
}

function fullText(f: AnalysisFinding): string {
  return `${f.title} ${f.description ?? ""}`;
}

export function priorityFor(score: number, config: ScoringConfig = DEFAULT_SCORING_CONFIG): ScoreResult["priority"] {
  if (score >= config.highPriorityScore) return "high";
  if (score >= config.mediumPriorityScore) return "medium";
  return "low";
}

/**
 * Wiederholungs-Score einer einzelnen Feststellung gegenüber der Historie
 * (z. B. für den Hinweis bei der Erfassung und im Bericht).
 */
export function scoreFinding(
  target: AnalysisFinding,
  history: AnalysisFinding[],
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): ScoreResult {
  if (!isDeviation(target)) return { score: 0, priority: "low", items: [], relatedIds: [] };
  const windowStart = target.createdAt.getTime() - config.windowDays * DAY_MS;

  const candidates = history.filter(
    (h) =>
      h.id !== target.id && isDeviation(h) && h.createdAt.getTime() >= windowStart && h.createdAt.getTime() <= target.createdAt.getTime(),
  );

  const related = candidates
    .map((h) => {
      const sameSub = !!target.subcategoryId && h.subcategoryId === target.subcategoryId;
      const sameCat = !!target.categoryId && h.categoryId === target.categoryId;
      const similarity = textSimilarity(fullText(target), fullText(h));
      const similar = similarity >= config.similarityThreshold && (sameCat || !target.categoryId);
      return { h, sameSub, similar, similarity };
    })
    .filter((r) => r.sameSub || r.similar);

  if (related.length === 0) {
    return { score: 0, priority: "low", items: [], relatedIds: [] };
  }

  const items: ScoreItem[] = [];
  const add = (criterion: string, label: string, points: number, detail: string) => {
    if (points > 0) items.push({ criterion, label, points, detail });
  };

  const sameSubCount = related.filter((r) => r.sameSub).length;
  if (sameSubCount > 0) {
    add(
      "same_subcategory",
      "Gleiche Unterkategorie",
      config.sameSubcategory,
      `${sameSubCount} Feststellung(en) mit Unterkategorie «${target.subcategoryName ?? "–"}» in den letzten ${config.windowDays} Tagen`,
    );
  }
  const similar = related.filter((r) => r.similar);
  if (similar.length > 0) {
    const best = Math.max(...similar.map((r) => r.similarity));
    add(
      "similar_text",
      "Ähnliche Beschreibung",
      config.similarText,
      `${similar.length} Feststellung(en) mit ähnlichem Wortlaut (höchste Übereinstimmung ${Math.round(best * 100)} %)`,
    );
  }
  const sameSite = related.filter((r) => r.h.siteId === target.siteId);
  if (sameSite.length > 0) {
    add("same_site", "Gleiche Baustelle", config.sameSite, `${sameSite.length} davon auf der Baustelle «${target.siteName}»`);
  }
  if (target.projectId) {
    const sameProject = related.filter((r) => r.h.projectId === target.projectId);
    if (sameProject.length > 0) add("same_project", "Gleiches Projekt", config.sameProject, `${sameProject.length} im selben Projekt`);
  }
  const sameCompany = related.filter((r) => r.h.companyId === target.companyId);
  if (sameCompany.length > 0) {
    add("same_company", "Gleiche Gesellschaft", config.sameCompany, `${sameCompany.length} bei «${target.companyName}»`);
  }
  if (target.trade) {
    const sameTrade = related.filter((r) => norm(r.h.trade) === norm(target.trade));
    if (sameTrade.length > 0)
      add("same_trade", "Gleicher Bereich / Gewerk", config.sameTrade, `${sameTrade.length} im Bereich «${target.trade}»`);
  }
  if (target.responsibleRole) {
    const sameRole = related.filter((r) => norm(r.h.responsibleRole) === norm(target.responsibleRole));
    if (sameRole.length > 0) {
      add(
        "same_role",
        "Gleiche Verantwortungsrolle",
        config.sameResponsibleRole,
        `${sameRole.length} mit Verantwortungsrolle «${target.responsibleRole}» (Rolle, nicht Person)`,
      );
    }
  }
  if (target.riskLevel === "high" || target.riskLevel === "critical") {
    add(
      "high_risk",
      "Hohe/kritische Risikostufe",
      config.highRisk,
      `Risikostufe der aktuellen Feststellung: ${target.riskLevel === "critical" ? "kritisch" : "hoch"}`,
    );
  }
  const overdueCount = related.filter((r) => r.h.overdue).length + (target.overdue ? 1 : 0);
  if (overdueCount > 0) {
    add("overdue", "Überfällige Massnahme", config.overdueAction, `${overdueCount} zugehörige Massnahme(n) mit überschrittener Frist`);
  }
  const additional = Math.min(related.length - 1, config.maxAdditional);
  if (additional > 0) {
    add(
      "additional",
      "Weitere ähnliche Feststellungen",
      additional * config.perAdditional,
      `+${config.perAdditional} je weitere ähnliche Feststellung (${additional})`,
    );
  }

  const score = items.reduce((s, i) => s + i.points, 0);
  return {
    score,
    priority: priorityFor(score, config),
    items,
    relatedIds: related.sort((a, b) => b.h.createdAt.getTime() - a.h.createdAt.getTime()).map((r) => r.h.id),
  };
}

// -----------------------------------------------------------------------------
// Cluster und Hinweise
// -----------------------------------------------------------------------------

export interface Cluster {
  key: string;
  scope: "site" | "company" | "group";
  companyId: string | null;
  companyName: string | null;
  siteId: string | null;
  siteName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  subcategoryId: string | null;
  subcategoryName: string | null;
  title: string;
  insight: string;
  recommendation: string;
  score: number;
  priority: ScoreResult["priority"];
  items: ScoreItem[];
  memberIds: string[];
  memberSimilarity: Record<string, number>;
  openCount: number;
  overdueCount: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

export interface Insight {
  kind: "late_actions" | "above_average_open";
  title: string;
  text: string;
  recommendation: string;
  criteria: string[];
  companyId: string | null;
  categoryId: string | null;
}

function recommendationFor(priority: ScoreResult["priority"]): string {
  switch (priority) {
    case "high":
      return "Empfehlung: Ursachenanalyse (z. B. 5-Why) durchführen sowie gezielte Instruktion bzw. Toolbox-Meeting prüfen. Wirksamkeit der Massnahmen bei der nächsten Kontrolle verifizieren.";
    case "medium":
      return "Empfehlung: Thema im nächsten Toolbox-Meeting aufgreifen und die Umsetzung der Massnahmen gezielt nachkontrollieren.";
    default:
      return "Empfehlung: Entwicklung weiter beobachten.";
  }
}

function groupBy<T>(list: T[], key: (t: T) => string | null): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of list) {
    const k = key(item);
    if (!k) continue;
    const arr = map.get(k) ?? [];
    arr.push(item);
    map.set(k, arr);
  }
  return map;
}

function avgPairSimilarity(members: AnalysisFinding[]): { mean: number; perMember: Record<string, number> } {
  const perMember: Record<string, number> = {};
  if (members.length < 2) return { mean: 0, perMember };
  let total = 0;
  let pairs = 0;
  for (const a of members) {
    let best = 0;
    for (const b of members) {
      if (a.id === b.id) continue;
      const s = textSimilarity(fullText(a), fullText(b));
      best = Math.max(best, s);
      total += s;
      pairs++;
    }
    perMember[a.id] = Math.round(best * 1000) / 1000;
  }
  return { mean: pairs ? total / pairs : 0, perMember };
}

function dominantShare(values: (string | null)[]): { value: string | null; share: number } {
  const counts = new Map<string, number>();
  for (const v of values) {
    const n = norm(v);
    if (!n) continue;
    counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  let best: string | null = null;
  let max = 0;
  for (const [k, c] of counts)
    if (c > max) {
      best = k;
      max = c;
    }
  const original = values.find((v) => norm(v) === best) ?? null;
  return { value: original, share: values.length ? max / values.length : 0 };
}

function scoreCluster(members: AnalysisFinding[], keyedBySubcategory: boolean, sameSite: boolean, config: ScoringConfig) {
  const items: ScoreItem[] = [];
  const add = (criterion: string, label: string, points: number, detail: string) => {
    if (points > 0) items.push({ criterion, label, points, detail });
  };
  const n = members.length;
  if (keyedBySubcategory) {
    add(
      "same_subcategory",
      "Gleiche Unterkategorie",
      config.sameSubcategory,
      `${n} Feststellungen derselben Unterkategorie innerhalb von ${config.windowDays} Tagen`,
    );
  }
  const { mean, perMember } = avgPairSimilarity(members);
  const maxSim = Math.max(0, ...Object.values(perMember));
  if (maxSim >= config.similarityThreshold) {
    add(
      "similar_text",
      "Ähnliche Beschreibung",
      config.similarText,
      `Textähnlichkeit bis ${Math.round(maxSim * 100)} % (Durchschnitt ${Math.round(mean * 100)} %)`,
    );
  }
  if (sameSite) add("same_site", "Gleiche Baustelle", config.sameSite, "Alle Feststellungen betreffen dieselbe Baustelle");
  const role = dominantShare(members.map((m) => m.responsibleRole));
  if (role.value && role.share >= 0.5 && n >= 2) {
    add(
      "same_role",
      "Wiederkehrende Verantwortungsrolle",
      config.sameResponsibleRole,
      `${Math.round(role.share * 100)} % mit Rolle «${role.value}» (Rolle, nicht Person)`,
    );
  }
  const trade = dominantShare(members.map((m) => m.trade));
  if (trade.value && trade.share >= 0.5 && n >= 2) {
    add("same_trade", "Gleicher Bereich / Gewerk", config.sameTrade, `${Math.round(trade.share * 100)} % im Bereich «${trade.value}»`);
  }
  const highRisk = members.filter((m) => m.riskLevel === "high" || m.riskLevel === "critical").length;
  if (highRisk > 0) add("high_risk", "Hohe/kritische Risikostufe", config.highRisk, `${highRisk} mit Risikostufe hoch oder kritisch`);
  const overdue = members.filter((m) => m.overdue).length;
  if (overdue > 0) add("overdue", "Überfällige Massnahmen", config.overdueAction, `${overdue} Massnahme(n) überfällig`);
  const additional = Math.min(n - 1, config.maxAdditional);
  if (additional > 0)
    add("additional", "Häufigkeit", additional * config.perAdditional, `+${config.perAdditional} je weitere Feststellung (${additional})`);
  const score = items.reduce((s, i) => s + i.points, 0);
  return { items, score, perMember, overdue };
}

function timeBounds(members: AnalysisFinding[]) {
  const times = members.map((m) => m.createdAt.getTime());
  return { first: new Date(Math.min(...times)), last: new Date(Math.max(...times)) };
}

/** Bildet Cluster auf Ebene Baustelle, Gesellschaft (systemisch) und Gruppe. */
export function buildClusters(findings: AnalysisFinding[], now: Date, config: ScoringConfig = DEFAULT_SCORING_CONFIG): Cluster[] {
  const windowStart = now.getTime() - config.windowDays * DAY_MS;
  const relevant = findings.filter((f) => isDeviation(f) && f.createdAt.getTime() >= windowStart && f.createdAt.getTime() <= now.getTime());
  const clusters: Cluster[] = [];

  // 1) Baustelle × (Unterkategorie, sonst Kategorie)
  const bySite = groupBy(relevant, (f) => {
    const topic = f.subcategoryId ? `sub:${f.subcategoryId}` : f.categoryId ? `cat:${f.categoryId}` : null;
    return topic ? `site:${f.siteId}|${topic}` : null;
  });
  for (const [key, members] of bySite) {
    if (members.length < config.minClusterSize) continue;
    const first = members[0];
    const keyedBySub = key.includes("|sub:");
    const { items, score, perMember, overdue } = scoreCluster(members, keyedBySub, true, config);
    const topic = keyedBySub ? `${first.categoryName ?? "Kategorie"} – ${first.subcategoryName}` : (first.categoryName ?? "Ohne Kategorie");
    const { first: firstSeen, last } = timeBounds(members);
    const priority = priorityFor(score, config);
    clusters.push({
      key,
      scope: "site",
      companyId: first.companyId,
      companyName: first.companyName,
      siteId: first.siteId,
      siteName: first.siteName,
      categoryId: first.categoryId,
      categoryName: first.categoryName,
      subcategoryId: keyedBySub ? first.subcategoryId : null,
      subcategoryName: keyedBySub ? first.subcategoryName : null,
      title: topic,
      insight: `«${topic}» wurde auf der Baustelle «${first.siteName}» in den letzten ${config.windowDays} Tagen ${members.length}-mal als Abweichung bzw. Verbesserungsmöglichkeit festgestellt.`,
      recommendation: recommendationFor(priority),
      score,
      priority,
      items,
      memberIds: members.map((m) => m.id),
      memberSimilarity: perMember,
      openCount: members.filter((m) => m.status === "open" || m.status === "in_progress").length,
      overdueCount: overdue,
      firstSeenAt: firstSeen,
      lastSeenAt: last,
    });
  }

  // 2) Gesellschaft × Kategorie über mehrere Baustellen (systemisches Thema)
  const byCompany = groupBy(relevant, (f) => (f.categoryId ? `company:${f.companyId}|cat:${f.categoryId}` : null));
  for (const [key, members] of byCompany) {
    const sites = new Set(members.map((m) => m.siteId));
    if (sites.size < 2 || members.length < Math.max(3, config.minClusterSize)) continue;
    const first = members[0];
    const { items, score, perMember, overdue } = scoreCluster(members, false, false, config);
    items.unshift({
      criterion: "multi_site",
      label: "Mehrere Baustellen",
      points: 0,
      detail: `Betrifft ${sites.size} Baustellen derselben Gesellschaft`,
    });
    const { first: firstSeen, last } = timeBounds(members);
    const priority = priorityFor(score, config);
    clusters.push({
      key,
      scope: "company",
      companyId: first.companyId,
      companyName: first.companyName,
      siteId: null,
      siteName: null,
      categoryId: first.categoryId,
      categoryName: first.categoryName,
      subcategoryId: null,
      subcategoryName: null,
      title: `${first.categoryName} – ${first.companyName}`,
      insight: `Bei «${first.companyName}» wurde «${first.categoryName}» in den letzten ${config.windowDays} Tagen auf ${sites.size} Baustellen insgesamt ${members.length}-mal festgestellt. Dies deutet auf ein baustellenübergreifendes Thema hin.`,
      recommendation: recommendationFor(priority),
      score,
      priority,
      items,
      memberIds: members.map((m) => m.id),
      memberSimilarity: perMember,
      openCount: members.filter((m) => m.status === "open" || m.status === "in_progress").length,
      overdueCount: overdue,
      firstSeenAt: firstSeen,
      lastSeenAt: last,
    });
  }

  // 3) Gruppe × Kategorie über mehrere Gesellschaften
  const byGroup = groupBy(relevant, (f) => (f.categoryId ? `group|cat:${f.categoryId}` : null));
  for (const [key, members] of byGroup) {
    const companies = new Set(members.map((m) => m.companyId));
    if (companies.size < 2 || members.length < Math.max(4, config.minClusterSize)) continue;
    const first = members[0];
    const { items, score, perMember, overdue } = scoreCluster(members, false, false, config);
    items.unshift({
      criterion: "multi_company",
      label: "Mehrere Gesellschaften",
      points: 0,
      detail: `Betrifft ${companies.size} Gesellschaften`,
    });
    const { first: firstSeen, last } = timeBounds(members);
    const priority = priorityFor(score, config);
    clusters.push({
      key,
      scope: "group",
      companyId: null,
      companyName: null,
      siteId: null,
      siteName: null,
      categoryId: first.categoryId,
      categoryName: first.categoryName,
      subcategoryId: null,
      subcategoryName: null,
      title: `${first.categoryName} – gruppenweit`,
      insight: `«${first.categoryName}» wurde in den letzten ${config.windowDays} Tagen bei ${companies.size} Gesellschaften insgesamt ${members.length}-mal festgestellt.`,
      recommendation: recommendationFor(priority),
      score,
      priority,
      items,
      memberIds: members.map((m) => m.id),
      memberSimilarity: perMember,
      openCount: members.filter((m) => m.status === "open" || m.status === "in_progress").length,
      overdueCount: overdue,
      firstSeenAt: firstSeen,
      lastSeenAt: last,
    });
  }

  return clusters.sort((a, b) => b.score - a.score || b.memberIds.length - a.memberIds.length);
}

/** Zusätzliche Hinweise: verspätete Massnahmen je Kategorie, überdurchschnittlich viele offene Abweichungen je Gesellschaft. */
export function buildInsights(findings: AnalysisFinding[], now: Date, config: ScoringConfig = DEFAULT_SCORING_CONFIG): Insight[] {
  const windowStart = now.getTime() - config.windowDays * 2 * DAY_MS;
  const relevant = findings.filter((f) => isDeviation(f) && f.createdAt.getTime() >= windowStart);
  const insights: Insight[] = [];

  for (const [, members] of groupBy(relevant, (f) => f.categoryId)) {
    const withDeadline = members.filter((m) => m.overdue || m.completedLate || m.status !== null);
    const late = members.filter((m) => m.overdue || m.completedLate).length;
    if (withDeadline.length >= 3 && late / withDeadline.length >= 0.4) {
      const name = members[0].categoryName ?? "Ohne Kategorie";
      insights.push({
        kind: "late_actions",
        title: `Verspätete Massnahmen: ${name}`,
        text: `Die Massnahmen zur Kategorie «${name}» werden häufig verspätet abgeschlossen (${late} von ${withDeadline.length}, ${Math.round((late / withDeadline.length) * 100)} %).`,
        recommendation: "Empfehlung: Realistische Fristen und Verantwortlichkeiten prüfen, Umsetzung in Baustellensitzungen nachverfolgen.",
        criteria: [
          "Massnahme überfällig oder nach Frist erledigt",
          `Betrachtungszeitraum ${config.windowDays * 2} Tage`,
          "Mindestens 3 Massnahmen, Anteil ≥ 40 %",
        ],
        companyId: null,
        categoryId: members[0].categoryId,
      });
    }
  }

  const open = relevant.filter((f) => f.status === "open" || f.status === "in_progress");
  const companies = Array.from(new Set(relevant.map((f) => f.companyId)));
  if (companies.length >= 2) {
    for (const [, catMembers] of groupBy(open, (f) => f.categoryId)) {
      const total = catMembers.length;
      if (total < 4) continue;
      const avg = total / companies.length;
      for (const [, compMembers] of groupBy(catMembers, (f) => f.companyId)) {
        if (compMembers.length >= 3 && compMembers.length >= avg * 1.5) {
          const f = compMembers[0];
          insights.push({
            kind: "above_average_open",
            title: `Offene Abweichungen: ${f.categoryName} bei ${f.companyName}`,
            text: `Bei «${f.companyName}» treten überdurchschnittlich viele offene Abweichungen in der Kategorie «${f.categoryName}» auf (${compMembers.length} gegenüber durchschnittlich ${avg.toFixed(1)} je Gesellschaft).`,
            recommendation: "Empfehlung: Ursachenanalyse und gezielte Instruktion bzw. Toolbox-Meeting prüfen.",
            criteria: [
              "Status offen oder in Bearbeitung",
              "Vergleich mit dem Durchschnitt aller Gesellschaften",
              "Schwelle: ≥ 150 % des Durchschnitts und mindestens 3",
            ],
            companyId: f.companyId,
            categoryId: f.categoryId,
          });
        }
      }
    }
  }
  return insights;
}
