import { describe, expect, it } from "vitest";
import { buildClusters, buildInsights, DEFAULT_SCORING_CONFIG, scoreFinding, scoringConfigSchema, type AnalysisFinding } from "@/lib/domain/recurrence";

const now = new Date("2026-09-01T10:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000);

function f(partial: Partial<AnalysisFinding> & { id: string }): AnalysisFinding {
  return {
    companyId: "c1", companyName: "Hochbau AG", siteId: "s1", siteName: "Wohnüberbauung Birr", projectId: null,
    categoryId: "absturz", categoryName: "Absturzsicherheit", subcategoryId: "absturz.seitenschutz",
    subcategoryName: "Seitenschutz fehlend oder mangelhaft", assessment: "negative", riskLevel: "high",
    responsibleRole: "Polier", trade: "Rohbau", title: "Seitenschutz fehlt", description: "Seitenschutz am Deckenrand fehlt",
    status: "open", createdAt: now, overdue: false, completedLate: false, ...partial,
  };
}

describe("Wiederholungs-Score einer Feststellung", () => {
  it("vergibt Punkte gemäss dokumentiertem Beispielmodell", () => {
    const target = f({ id: "t" });
    const history = [
      f({ id: "h1", createdAt: daysAgo(10), overdue: true }),
      f({ id: "h2", createdAt: daysAgo(30) }),
    ];
    const r = scoreFinding(target, history, { ...DEFAULT_SCORING_CONFIG, sameTrade: 0 });
    const points = Object.fromEntries(r.items.map((i) => [i.criterion, i.points]));
    expect(points).toMatchObject({ same_subcategory: 3, similar_text: 2, same_site: 2, same_role: 2, high_risk: 3, overdue: 2, additional: 1 });
    expect(r.score).toBe(15);
    expect(r.priority).toBe("high");
    expect(r.relatedIds).toEqual(["h1", "h2"]);
  });

  it("berücksichtigt nur Feststellungen im Zeitfenster", () => {
    const r = scoreFinding(f({ id: "t" }), [f({ id: "old", createdAt: daysAgo(200) })]);
    expect(r.score).toBe(0);
    expect(r.items).toEqual([]);
  });

  it("bewertet positive Feststellungen nicht", () => {
    expect(scoreFinding(f({ id: "t", assessment: "positive" }), [f({ id: "h", createdAt: daysAgo(1) })]).score).toBe(0);
  });

  it("ist konfigurierbar", () => {
    const cfg = scoringConfigSchema.parse({ sameSubcategory: 10, highRisk: 0, similarText: 0, sameSite: 0, sameResponsibleRole: 0, sameTrade: 0, overdueAction: 0, perAdditional: 0 });
    const r = scoreFinding(f({ id: "t" }), [f({ id: "h", createdAt: daysAgo(5) })], cfg);
    expect(r.score).toBe(10);
  });

  it("formuliert Rollen, nicht Personen", () => {
    const r = scoreFinding(f({ id: "t" }), [f({ id: "h", createdAt: daysAgo(5) })]);
    expect(r.items.find((i) => i.criterion === "same_role")?.detail).toContain("Rolle, nicht Person");
  });
});

describe("Cluster", () => {
  const findings: AnalysisFinding[] = [
    ...Array.from({ length: 6 }, (_, i) => f({ id: `a${i}`, createdAt: daysAgo(5 + i * 10), overdue: i === 0 })),
    f({ id: "b1", siteId: "s2", siteName: "MFH Zürich Nord", createdAt: daysAgo(3) }),
    f({ id: "x1", companyId: "c2", companyName: "Tiefbau AG", siteId: "s3", siteName: "Beispielstrasse", createdAt: daysAgo(2) }),
    f({ id: "p1", assessment: "positive", createdAt: daysAgo(1) }),
  ];

  it("bildet Baustellen-Cluster mit erklärtem Score und Hinweistext", () => {
    const clusters = buildClusters(findings, now);
    const site = clusters.find((c) => c.scope === "site" && c.siteId === "s1");
    expect(site).toBeDefined();
    expect(site!.memberIds).toHaveLength(6);
    expect(site!.insight).toContain("Wohnüberbauung Birr");
    expect(site!.insight).toContain("6-mal");
    expect(site!.items.map((i) => i.criterion)).toEqual(expect.arrayContaining(["same_subcategory", "same_site", "high_risk", "overdue", "additional"]));
    expect(site!.score).toBe(site!.items.reduce((s, i) => s + i.points, 0));
    expect(site!.recommendation).toContain("Empfehlung");
  });

  it("erkennt systemische Themen über mehrere Baustellen einer Gesellschaft", () => {
    const company = buildClusters(findings, now).find((c) => c.scope === "company");
    expect(company?.companyId).toBe("c1");
    expect(company?.insight).toContain("2 Baustellen");
  });

  it("erkennt gruppenweite Themen", () => {
    expect(buildClusters(findings, now).some((c) => c.scope === "group")).toBe(true);
  });

  it("ignoriert positive Feststellungen", () => {
    expect(buildClusters(findings, now).every((c) => !c.memberIds.includes("p1"))).toBe(true);
  });
});

describe("Hinweise", () => {
  it("erkennt verspätete Massnahmen je Kategorie", () => {
    const list = [
      f({ id: "1", overdue: true }), f({ id: "2", completedLate: true, status: "closed" }),
      f({ id: "3", overdue: true }), f({ id: "4" }),
    ];
    const insights = buildInsights(list, now);
    expect(insights.some((i) => i.kind === "late_actions" && i.text.includes("verspätet"))).toBe(true);
  });
});
