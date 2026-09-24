import { describe, expect, it } from "vitest";
import { classifyFinding, completenessHints, type CatalogCategory } from "@/lib/domain/classifier";
import { SEED_CATEGORIES } from "@/lib/domain/catalog-data";

const catalog: CatalogCategory[] = SEED_CATEGORIES.map((c) => ({
  id: c.code,
  code: c.code,
  name: c.name,
  keywords: c.keywords,
  defaultRisk: c.defaultRisk,
  sampleAction: c.sampleAction,
  referenceIds: c.references,
  subcategories: c.subcategories.map((s) => ({
    id: s.code,
    code: s.code,
    name: s.name,
    keywords: s.keywords,
    defaultRisk: s.defaultRisk ?? null,
    sampleAction: s.sampleAction ?? null,
  })),
}));

describe("Regelbasierter Klassifikator", () => {
  it("klassifiziert fehlenden Seitenschutz als Absturzsicherheit / Abweichung", () => {
    const r = classifyFinding({ title: "Seitenschutz fehlt", description: "Am Dachrand fehlt der Seitenschutz auf 4 m Höhe." }, catalog);
    expect(r.categoryId).toBe("absturz");
    expect(r.assessment).toBe("negative");
    expect(["high", "critical"]).toContain(r.riskLevel);
    expect(r.explanation.join(" ")).toContain("Schlagworte");
    expect(r.suggestedActions.length).toBeGreaterThan(0);
  });

  it("erkennt elektrische Provisorien", () => {
    const r = classifyFinding(
      { title: "Kabelrolle nicht abgewickelt", description: "Provisorische Beleuchtung über Mehrfachstecker, Kabel beschädigt" },
      catalog,
    );
    expect(r.categoryId).toBe("elektro");
    expect(r.assessment).toBe("negative");
  });

  it("erkennt positive Feststellungen und schlägt keine Massnahmen vor", () => {
    const r = classifyFinding(
      { title: "Gerüst vorbildlich", description: "Fassadengerüst einwandfrei erstellt, Gerüstfreigabe gut sichtbar" },
      catalog,
    );
    expect(r.categoryId).toBe("geruest");
    expect(r.assessment).toBe("positive");
    expect(r.riskLevel).toBeNull();
    expect(r.suggestedActions).toEqual([]);
  });

  it("wertet 'unvollständig' nicht als positiv", () => {
    const r = classifyFinding({ title: "Gerüstbelag unvollständig", description: "Belag auf Lage 3 unvollständig" }, catalog);
    expect(r.assessment).toBe("negative");
  });

  it("erkennt Verbesserungsmöglichkeiten", () => {
    const r = classifyFinding({ title: "Abfalltrennung optimieren", description: "Mulden könnten besser beschriftet werden" }, catalog);
    expect(r.assessment).toBe("improvement");
    expect(r.categoryId).toBe("umwelt");
  });

  it("setzt kritisch bei schwebender Last", () => {
    const r = classifyFinding(
      { title: "Aufenthalt unter schwebender Last", description: "Mitarbeitende unter schwebender Last beim Kranhub" },
      catalog,
    );
    expect(r.categoryId).toBe("krane");
    expect(r.riskLevel).toBe("critical");
  });

  it("liefert ohne Treffer keinen Vorschlag", () => {
    const r = classifyFinding({ title: "Allgemeine Notiz" }, catalog);
    expect(r.categoryId).toBeNull();
    expect(r.confidence).toBe(0);
  });
});

describe("Vollständigkeitshinweise", () => {
  it("verlangt Kategorie und Rolle bei kritischer Abweichung", () => {
    const hints = completenessHints({
      assessment: "negative",
      riskLevel: "critical",
      categoryId: null,
      responsibleRole: "",
      dueDate: null,
      actionDescription: null,
      description: "kurz",
      imageCount: 0,
    });
    const errors = hints.filter((h) => h.level === "error").map((h) => h.message);
    expect(errors.some((m) => m.includes("Kategorie"))).toBe(true);
    expect(errors.some((m) => m.includes("Rolle"))).toBe(true);
    expect(errors.some((m) => m.includes("Massnahme"))).toBe(true);
  });
  it("gibt bei positiven Feststellungen keine Hinweise", () => {
    expect(
      completenessHints({
        assessment: "positive",
        riskLevel: null,
        categoryId: null,
        responsibleRole: null,
        dueDate: null,
        actionDescription: null,
        description: null,
        imageCount: 0,
      }),
    ).toEqual([]);
  });
});
