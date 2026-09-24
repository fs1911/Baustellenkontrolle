import { describe, expect, it } from "vitest";
import { buildRuleSummary } from "@/lib/domain/summary";
import { bodyToHtml, checkRecipientPolicy, defaultSubject, parseAddressList } from "@/lib/domain/email";

describe("Regelbasierte Management Summary", () => {
  const base = {
    companyName: "Beispielgesellschaft Hochbau AG", siteName: "Wohnüberbauung Birr", inspectionType: "Routinekontrolle",
    inspectionDate: "12.08.2026",
    counts: { total: 6, positive: 2, negative: 3, improvement: 1, criticalOrHigh: 1, openActions: 3, recurring: 2 },
    topCategories: [{ name: "Absturzsicherheit", count: 2 }],
    criticalItems: [{ title: "Seitenschutz fehlt", category: "Absturzsicherheit", risk: "Kritisch" }],
    positiveHighlights: ["Gerüst vorbildlich"],
  };
  it("enthält nur gelieferte Fakten", () => {
    const text = buildRuleSummary(base);
    expect(text).toContain("6 Feststellungen");
    expect(text).toContain("2 positive Feststellungen");
    expect(text).toContain("«Seitenschutz fehlt»");
    expect(text).toContain("wiederkehrend");
    expect(text).not.toMatch(/ß/);
  });
  it("formuliert ohne Risiken entlastend", () => {
    const text = buildRuleSummary({ ...base, counts: { ...base.counts, criticalOrHigh: 0, recurring: 0 }, criticalItems: [] });
    expect(text).toContain("keine Abweichungen mit hoher oder kritischer Risikostufe");
  });
});

describe("E-Mail", () => {
  it("baut den Betreff gemäss Vorgabe", () => {
    expect(defaultSubject({ companyName: "tozzo gruppe ag", siteName: "Birr", siteNumber: null, inspectionDate: "01.09.2026", reportNumber: "TOZ-2026-0001", senderName: "X", summary: "", positives: 0, deviations: 0, improvements: 0, openActions: 0, criticalOrHigh: 0 }))
      .toBe("Baustellenkontrollbericht – tozzo gruppe ag – Birr – 01.09.2026");
  });
  it("prüft Adresslisten", () => {
    expect(parseAddressList("a@b.ch; falsch, C@D.CH a@b.ch")).toEqual({ valid: ["a@b.ch", "c@d.ch"], invalid: ["falsch"] });
  });
  it("beschränkt freie Empfänger für Projektleitende", () => {
    const errors = checkRecipientPolicy({ to: ["pl@firma.ch", "extern@andere.ch"], cc: [], bcc: [], senderEmail: "pl@firma.ch", companyDistribution: [], siteMemberEmails: [], mayUseArbitraryRecipients: false });
    expect(errors.join()).toContain("extern@andere.ch");
    expect(checkRecipientPolicy({ to: ["extern@andere.ch"], cc: [], bcc: [], senderEmail: "x@y.ch", companyDistribution: [], siteMemberEmails: [], mayUseArbitraryRecipients: true })).toEqual([]);
  });
  it("escaped Benutzereingaben im HTML", () => {
    const html = bodyToHtml("<script>alert(1)</script>", { companyName: "A&B", primaryColor: "javascript:x", disclaimer: "d" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("A&amp;B");
    expect(html).toContain("#1f2937");
  });
});
