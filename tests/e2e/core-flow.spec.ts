import { expect, test } from "@playwright/test";
import { login, testImage, USERS } from "./helpers";

/**
 * Kernprozess (mobil): Kontrolle erstellen → Feststellungen mit Foto erfassen → Bericht prüfen →
 * PDF → freigeben und senden → Versandprotokoll → Dashboard.
 */
test("Kernprozess Baustellenkontrolle bis Versand", async ({ page }) => {
  await login(page, USERS.pl);

  // 1. Neue Kontrolle – Gesellschaft ist Pflicht
  await page.goto("/kontrollen/neu");
  await page.getByRole("radio", { name: /Beispielgesellschaft Hochbau AG/ }).click();
  const siteSelect = page.getByLabel("Baustelle");
  const value = await siteSelect.locator("option", { hasText: "Wohnüberbauung Birr" }).getAttribute("value");
  await siteSelect.selectOption(value!);
  await expect(page.locator("dl").getByText("BHB-24-017")).toBeVisible();
  await page.getByRole("button", { name: "Person hinzufügen" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Beat Huber");
  await page.getByRole("button", { name: "Kontrolle starten" }).click();
  await expect(page).toHaveURL(/\/kontrollen\/[0-9a-f-]{36}$/);
  const inspectionUrl = page.url();

  // 2. Feststellung mit Foto, KI-Vorschlag und Massnahme
  await page.getByRole("link", { name: /^Feststellung$/ }).click();
  await page.getByRole("radio", { name: /Abweichung/ }).check({ force: true });
  await page.getByLabel("Titel").fill("Seitenschutz fehlt an Deckenrand E2E");
  await page.getByLabel("Beschreibung / Kommentar").fill("Am Deckenrand fehlt der Seitenschutz, Absturzhöhe 4 m.");
  await page.getByRole("button", { name: "Vorschlag erstellen" }).click();
  const suggestion = page.getByRole("region", { name: "KI-Vorschlag" });
  await expect(suggestion).toContainText("Vorschlag");
  await expect(suggestion).toContainText("Absturzsicherheit");
  await suggestion.getByRole("button", { name: "Übernehmen" }).click();
  await page.getByTestId("gallery-input").setInputFiles(await testImage());
  await expect(page.getByRole("img", { name: /Neues Foto 1/ })).toBeVisible();
  await page.getByLabel("Bildlegende Foto 1").fill("Deckenrand Nord");
  await page.getByLabel("Verantwortliche Rolle").fill("Polier");
  await page.getByLabel("Frist").fill("2026-12-31");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page).toHaveURL(inspectionUrl);
  const item = page.getByRole("listitem").filter({ hasText: "Seitenschutz fehlt an Deckenrand E2E" });
  await expect(item).toContainText("Abweichung");
  await expect(item.getByRole("img", { name: "Deckenrand Nord" })).toBeVisible();

  // 3. Positive Feststellung über die Schnellerfassung
  await page.getByRole("link", { name: "Schnellerfassung", exact: true }).click();
  await page.getByRole("button", { name: "Positiv" }).click();
  await page.getByLabel("Titel").fill("Ordnung auf Etage vorbildlich E2E");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("1 in dieser Sitzung erfasst")).toBeVisible();
  await page.goto(inspectionUrl);
  await expect(page.getByText("Ordnung auf Etage vorbildlich E2E")).toBeVisible();

  // 4. Bericht prüfen, PDF, freigeben und senden
  await page.getByRole("link", { name: "Bericht" }).click();
  const preview = page.getByRole("article", { name: "Berichtsvorschau" });
  await expect(preview).toContainText("Baustellenkontrollbericht");
  await expect(preview).toContainText("Seitenschutz fehlt an Deckenrand E2E");
  await expect(preview.getByRole("img", { name: /Logo Beispielgesellschaft Hochbau AG/ })).toBeVisible();
  await expect(preview).toContainText("Würdigung im Einzelfall");
  const pdf = await page.request.get(`${inspectionUrl.replace(/.*\/kontrollen\//, "/api/reports/")}/pdf`);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");

  await page.getByRole("button", { name: "Summary vorschlagen" }).click();
  await expect(page.getByLabel(/Management Summary/)).toHaveValue(/Feststellungen/);
  await expect(page.getByLabel("Betreff")).toHaveValue(/Baustellenkontrollbericht – Beispielgesellschaft Hochbau AG – Wohnüberbauung Birr – /);
  await page.getByRole("button", { name: "Bericht freigeben und senden" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Jetzt freigeben und senden" })).toBeDisabled();
  await dialog.getByLabel(/geprüft und gebe ihn zur Versendung frei/).check();
  await dialog.getByRole("button", { name: "Jetzt freigeben und senden" }).click();
  await expect(page.getByText(/freigegeben und versendet/).first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("table", { name: "Versandprotokoll" })).toContainText("Gesendet");
  await expect(page.getByRole("table", { name: "Versandprotokoll" })).toContainText(USERS.pl);

  // 5. Dashboard ist aktualisiert
  await page.goto("/dashboard");
  await expect(page.getByRole("region", { name: "Kennzahlen" })).toContainText("Feststellungen");
});
