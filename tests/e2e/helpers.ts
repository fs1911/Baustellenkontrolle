import { expect, type Page } from "@playwright/test";

export const PASSWORD = process.env.DEMO_PASSWORD ?? "Baustelle!2026";
export const USERS = {
  admin: "admin@tozzo-gruppe.example",
  sibe: "sibe@tozzo-gruppe.example",
  pl: "s.meier@hochbau.example",
  plTiefbau: "l.rossi@tiefbau.example",
  polier: "b.huber@hochbau.example",
  mgmt: "gl@tozzo-gruppe.example",
} as const;

export async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Geschäftliche E-Mail-Adresse").fill(email);
  await page.getByLabel("Passwort").fill(PASSWORD);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

export async function testImage(): Promise<{ name: string; mimeType: string; buffer: Buffer }> {
  const sharp = (await import("sharp")).default;
  const buffer = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: "#7a8fa6" } })
    .composite([
      {
        input: Buffer.from(
          '<svg width="1600" height="1200"><rect x="200" y="300" width="900" height="500" fill="#d1d5db"/><rect x="200" y="280" width="900" height="20" fill="#f59e0b"/></svg>',
        ),
        top: 0,
        left: 0,
      },
    ])
    .jpeg({ quality: 85 })
    .withMetadata({ exif: { IFD0: { Make: "TestCam" } } })
    .toBuffer();
  return { name: "baustelle.jpg", mimeType: "image/jpeg", buffer };
}
