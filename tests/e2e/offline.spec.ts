import { expect, test } from "@playwright/test";
import { login, testImage, USERS } from "./helpers";

test("Offline erfasste Feststellung wird nach Wiederverbindung synchronisiert", async ({ page, context }) => {
  await login(page, USERS.sibe);
  await page.goto("/kontrollen?q=Zürich");
  await page.getByRole("link", { name: /Mehrfamilienhaus Zürich Nord/ }).first().click();
  await page.getByRole("link", { name: "Schnellerfassung", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Schnellerfassung" })).toBeVisible();

  await context.setOffline(true);
  await expect(page.getByText(/Offline – neue Erfassungen werden auf dem Gerät gespeichert/)).toBeVisible();
  await page.getByTestId("quick-camera-input").setInputFiles(await testImage());
  await page.getByRole("button", { name: "Abweichung" }).click();
  const title = `Offline erfasst: Absperrung fehlt ${Date.now()}`;
  await page.getByLabel("Titel").fill(title);
  await page.getByRole("button", { name: "Mittel" }).click();
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText(/Offline gespeichert/)).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText(/offline erfasste Feststellung\(en\) synchronisiert/)).toBeVisible({ timeout: 30_000 });
  await page.getByRole("link", { name: "Zur Kontrolle (Details ergänzen)" }).click();
  await expect(page.getByText(title)).toBeVisible();
});
