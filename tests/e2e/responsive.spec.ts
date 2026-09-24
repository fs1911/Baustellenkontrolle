import { expect, test } from "@playwright/test";
import { login, USERS } from "./helpers";

const VIEWPORTS = [
  { name: "Smartphone", width: 375, height: 812 },
  { name: "Tablet", width: 820, height: 1180 },
  { name: "Desktop", width: 1440, height: 900 },
];
const PAGES = ["/dashboard", "/kontrollen", "/kontrollen/neu", "/massnahmen", "/management"];

for (const vp of VIEWPORTS) {
  test(`Kein horizontales Scrollen – ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await login(page, USERS.sibe);
    for (const path of PAGES) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${path} bei ${vp.width}px`).toBeLessThanOrEqual(1);
    }
  });
}

test("Touch-Ziele der Schnellerfassung sind mindestens 48 px hoch", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await login(page, USERS.sibe);
  await page.goto("/kontrollen?q=Birr");
  await page
    .getByRole("link", { name: /Wohnüberbauung Birr/ })
    .first()
    .click();
  await page.getByRole("link", { name: "Schnellerfassung", exact: true }).click();
  for (const name of ["Foto aufnehmen", "Positiv", "Abweichung", "Verbesserung", "Speichern"]) {
    const box = await page.getByRole("button", { name, exact: false }).first().boundingBox();
    expect(box!.height, name).toBeGreaterThanOrEqual(48);
  }
});
