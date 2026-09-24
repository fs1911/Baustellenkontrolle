import { defineConfig, devices } from "@playwright/test";

/**
 * E2E-Tests gegen den Produktions-Build (next start) mit lokaler DB, Sandbox-Mailer und Regel-KI.
 * Voraussetzung: `npm run db:reset` (bzw. db:migrate + db:seed) und `npm run build`.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "de-CH",
    timezoneId: "Europe/Zurich",
    launchOptions: { executablePath },
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"], launchOptions: { executablePath } } },
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } }, testMatch: /(a11y|responsive|permissions)\.spec\.ts/ },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { MAIL_SANDBOX_DIR: ".data/e2e-mail-sandbox" },
  },
});
