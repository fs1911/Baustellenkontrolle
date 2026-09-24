/**
 * Berichtsgenerierung und Versand (Sandbox) über die echte Service-Schicht.
 * Voraussetzung: migrierte und geseedete Datenbank.
 */
import { readdirSync, rmSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, withService, withUser } from "@/lib/db/client";
import { permissionsSchema } from "@/lib/domain/permissions";
import type { CurrentUser } from "@/lib/auth/session";
import { buildReportContent } from "@/lib/services/reports/model";
import { renderReportPdf } from "@/lib/services/pdf/render";
import { releaseAndSend, retryDelivery } from "@/lib/services/reports/service";

async function loadUser(email: string): Promise<CurrentUser> {
  const [p] = await withService((tx) => tx<{ id: string; fullName: string }[]>`select id, full_name from public.user_profiles where business_email = ${email}`);
  const perms = await withUser(p.id, (tx) => tx<{ perms: string }[]>`select app.my_permissions()::text as perms`);
  return { id: p.id, email, fullName: p.fullName, businessEmail: email, jobTitle: null, defaultCompanyId: null, permissions: permissionsSchema.parse(JSON.parse(perms[0].perms)) };
}

let sibe: CurrentUser;
let pl: CurrentUser;
let inspectionId: string;
let foreignInspectionId: string;

beforeAll(async () => {
  rmSync(".data/test-mail-sandbox", { recursive: true, force: true });
  sibe = await loadUser("sibe@tozzo-gruppe.example");
  pl = await loadUser("s.meier@hochbau.example");
  const rows = await withService((tx) => tx<{ id: string; name: string }[]>`
    select i.id, s.name from public.inspections i join public.construction_sites s on s.id = i.site_id
    where i.deleted_at is null and not exists (select 1 from public.generated_reports r where r.inspection_id = i.id)
    order by (select count(*) from public.finding_images fi join public.findings f on f.id = fi.finding_id where f.inspection_id = i.id) desc`);
  inspectionId = rows.find((r) => r.name === "Wohnüberbauung Birr")!.id;
  foreignInspectionId = rows.find((r) => r.name === "Infrastrukturprojekt Beispielstrasse")!.id;
});

afterAll(async () => {
  await closeDb();
});

describe("Berichtsinhalt", () => {
  it("enthält Gesellschaft, Logo, Feststellungen, Massnahmen und Disclaimer", async () => {
    const built = await withUser(sibe.id, (tx) => buildReportContent(tx, inspectionId, { reportNumber: "TEST-1", versionNo: 1, status: "draft", summaryText: "Test" }));
    const c = built!.content;
    expect(c.company.name).toBe("Beispielgesellschaft Hochbau AG");
    expect(c.company.logoPath).toMatch(/\.png$/);
    expect(c.findings.length).toBeGreaterThan(0);
    expect(c.findings.some((f) => f.images.length > 0)).toBe(true);
    expect(c.company.disclaimer).toContain("Würdigung im Einzelfall");
    expect(c.counts.total).toBe(c.findings.length);
  });

  it("erzeugt ein mehrseitiges PDF mit eingebetteten Bildern", async () => {
    const built = await withUser(sibe.id, (tx) => buildReportContent(tx, inspectionId, { reportNumber: "TEST-1", versionNo: 1, status: "draft", summaryText: "Test" }));
    const pdf = await renderReportPdf(built!.content);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    const text = pdf.toString("latin1");
    expect((text.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect((text.match(/\/Subtype \/Image/g) ?? []).length).toBeGreaterThanOrEqual(2); // Logo + Foto
  });
});

describe("Freigabe und Versand", () => {
  it("versendet nach Freigabe an die eigene Geschäftsadresse und protokolliert alles", async () => {
    const result = await releaseAndSend(pl, inspectionId, {
      summaryText: "Zusammenfassung", closingText: "Schluss", to: [pl.businessEmail], cc: [], bcc: [],
      subject: "Baustellenkontrollbericht – Test", body: "Guten Tag\n\nIm Anhang der Bericht.",
    });
    expect(result.status).toBe("sent");
    expect(result.reportNumber).toMatch(/^BHB-\d{4}-\d{4}$/);
    const [state] = await withService((tx) => tx<{ status: string; isFinal: boolean; pdfSha256: string; deliveryStatus: string; sentBy: string }[]>`
      select r.status, v.is_final, v.pdf_sha256, d.status as delivery_status, d.sent_by
      from public.generated_reports r join public.report_versions v on v.id = r.current_version_id
      join public.email_deliveries d on d.report_id = r.id where r.inspection_id = ${inspectionId}`);
    expect(state).toMatchObject({ status: "sent", isFinal: true, deliveryStatus: "sent", sentBy: pl.id });
    expect(state.pdfSha256).toHaveLength(64);
    const events = await withService((tx) => tx<{ action: string }[]>`select action from public.audit_logs where entity_type in ('generated_reports','email_deliveries') and actor_id = ${pl.id}`);
    expect(events.map((e) => e.action)).toEqual(expect.arrayContaining(["release", "send"]));
    const files = readdirSync(".data/test-mail-sandbox");
    expect(files.some((f) => f.endsWith(".eml"))).toBe(true);
  });

  it("verweigert Projektleitenden freie externe Empfänger", async () => {
    await expect(
      releaseAndSend(pl, inspectionId, { summaryText: "", closingText: "", to: ["extern@fremd.example"], cc: [], bcc: [], subject: "Test Betreff", body: "x" }),
    ).rejects.toThrow(/freie Empfänger/);
  });

  it("verweigert den Versand für fremde Baustellen", async () => {
    await expect(
      releaseAndSend(pl, foreignInspectionId, { summaryText: "", closingText: "", to: [pl.businessEmail], cc: [], bcc: [], subject: "Test Betreff", body: "x" }),
    ).rejects.toThrow();
  });

  it("erlaubt Retry nur für fehlgeschlagene Aufträge", async () => {
    const [d] = await withService((tx) => tx<{ id: string }[]>`select d.id from public.email_deliveries d join public.generated_reports r on r.id = d.report_id where r.inspection_id = ${inspectionId}`);
    await expect(retryDelivery(pl, d.id)).rejects.toThrow(/fehlgeschlagene/);
  });
});
