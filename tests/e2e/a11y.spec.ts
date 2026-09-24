import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { login, USERS } from "./helpers";

const PAGES = ["/dashboard", "/kontrollen", "/kontrollen/neu", "/massnahmen", "/wiederkehrend", "/feststellungen", "/admin/katalog"];

test("Anmeldeseite ohne schwere Barrierefreiheitsfehler", async ({ page }) => {
  await page.goto("/login");
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical"), JSON.stringify(r.violations, null, 2)).toEqual([]);
});

for (const path of PAGES) {
  test(`Barrierefreiheit (WCAG 2 A/AA, schwer/kritisch): ${path}`, async ({ page }) => {
    await login(page, USERS.admin);
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).exclude(".recharts-wrapper").analyze();
    const severe = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(severe.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
  });
}
