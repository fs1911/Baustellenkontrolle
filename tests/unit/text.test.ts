import { describe, expect, it } from "vitest";
import { containsKeyword, normalizeText, textSimilarity } from "@/lib/domain/text";

describe("Textähnlichkeit", () => {
  it("erkennt Flexionen und Komposita als ähnlich", () => {
    expect(textSimilarity("Seitenschutz fehlt am Dachrand", "Fehlender Seitenschutz beim Dachrand")).toBeGreaterThan(0.5);
  });
  it("bewertet unterschiedliche Themen als unähnlich", () => {
    expect(textSimilarity("Seitenschutz fehlt am Dachrand", "Feuerlöscher nicht geprüft")).toBeLessThan(0.2);
  });
  it("liefert 0 bei leeren Texten", () => {
    expect(textSimilarity("", "Gerüst")).toBe(0);
  });
});

describe("Schlagworterkennung", () => {
  const t = normalizeText("Belastung der Decke durch Palettenlager; FI-Schalter ausgelöst, Absturzsicherung fehlt");
  it("findet lange Begriffe in Komposita", () => {
    expect(containsKeyword(t, "absturz")).toBe(true);
  });
  it("findet mittellange Begriffe nur am Wortanfang", () => {
    expect(containsKeyword(t, "last")).toBe(false);
    expect(containsKeyword(normalizeText("Lasten schweben"), "last")).toBe(true);
  });
  it("findet kurze Begriffe nur als ganzes Wort", () => {
    expect(containsKeyword(t, "fi")).toBe(true);
    expect(containsKeyword(normalizeText("Profi-Werkzeug"), "fi")).toBe(false);
  });
});
