import { expect, test } from "@playwright/test";
import { login, USERS } from "./helpers";

test.describe("Berechtigungen im UI und serverseitig", () => {
  test("Polier sieht nur Massnahmen der eigenen Baustelle und keine Verwaltung", async ({ page }) => {
    await login(page, USERS.polier);
    await expect(page).toHaveURL(/\/massnahmen/);
    await expect(page.getByRole("article").first()).toContainText("Wohnüberbauung Birr");
    await expect(page.getByRole("article").filter({ hasText: "Infrastrukturprojekt Beispielstrasse" })).toHaveCount(0);
    await page.goto("/admin/benutzer").catch(() => undefined);
    await expect(page).toHaveURL(/\/dashboard|\/massnahmen/);
    await page.waitForLoadState("networkidle");
    await page.goto("/kontrollen/neu").catch(() => undefined);
    await expect(page).toHaveURL(/\/kontrollen$/);
  });

  test("Fremde Kontrolle ist für Projektleiter nicht abrufbar", async ({ page, request }) => {
    await login(page, USERS.sibe);
    await page.goto("/kontrollen?q=Beispielstrasse");
    const href = await page
      .getByRole("link", { name: /Infrastrukturprojekt Beispielstrasse/ })
      .first()
      .getAttribute("href");
    await page.context().clearCookies();
    await login(page, USERS.pl);
    await page.goto(href!);
    await expect(page.getByText("Nicht gefunden oder keine Berechtigung")).toBeVisible();
    const pdf = await page.request.get(`/api/reports/${href!.split("/").pop()}/pdf`);
    expect(pdf.status()).toBe(404);
    expect(request).toBeTruthy();
  });

  test("Management hat Lesezugriff ohne Erfassungsfunktionen", async ({ page }) => {
    await login(page, USERS.mgmt);
    await page.goto("/management");
    await expect(page.getByRole("heading", { name: "Management-Ansicht" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Neue Kontrolle" })).toHaveCount(0);
    const xlsx = await page.request.get("/api/export/management?format=xlsx");
    expect(xlsx.headers()["content-type"]).toContain("spreadsheetml");
  });

  test("Nicht angemeldete Zugriffe werden abgewiesen", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
    const api = await page.request.get("/api/findings/similar?text=test");
    expect(api.status()).toBe(401);
  });
});
