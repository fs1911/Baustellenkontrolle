/**
 * Berechtigungs- und RLS-Tests gegen die echte Datenbank (supabase/postgres).
 * Voraussetzung: `npm run db:migrate && npm run db:seed`.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asService, asUser, siteId, sql, userId } from "../support/db";

let U: Record<string, string>;
let S: Record<string, string>;

beforeAll(async () => {
  U = {
    admin: await userId("admin@tozzo-gruppe.example"),
    sibe: await userId("sibe@tozzo-gruppe.example"),
    plHochbau: await userId("s.meier@hochbau.example"),
    plTiefbau: await userId("l.rossi@tiefbau.example"),
    polier: await userId("b.huber@hochbau.example"),
    mgmt: await userId("gl@tozzo-gruppe.example"),
  };
  S = {
    birr: await siteId("Wohnüberbauung Birr"),
    aargau: await siteId("Sanierung Gewerbeobjekt Aargau"),
    strasse: await siteId("Infrastrukturprojekt Beispielstrasse"),
    zuerich: await siteId("Mehrfamilienhaus Zürich Nord"),
  };
});

afterAll(async () => {
  await sql.end();
});

async function visibleSites(user: string) {
  return asUser(user, async (tx) => (await tx<{ siteId: string }[]>`select distinct site_id from public.inspections`).map((r) => r.siteId).sort());
}

describe("Mandantentrennung und Baustellenzuordnung", () => {
  it("Gruppen-SIBE sieht alle Baustellen", async () => {
    expect(await visibleSites(U.sibe)).toEqual([S.birr, S.aargau, S.strasse, S.zuerich].sort());
  });

  it("Projektleiterin sieht nur zugeordnete Baustellen", async () => {
    expect(await visibleSites(U.plHochbau)).toEqual([S.birr, S.zuerich].sort());
  });

  it("Polier sieht nur die zugewiesene Baustelle", async () => {
    expect(await visibleSites(U.polier)).toEqual([S.birr]);
  });

  it("Polier sieht keine fremden Feststellungen, Bilder oder Massnahmen", async () => {
    await asUser(U.polier, async (tx) => {
      const [f] = await tx<{ n: number }[]>`select count(*)::int as n from public.findings where site_id <> ${S.birr}`;
      const [i] = await tx<{ n: number }[]>`select count(*)::int as n from public.finding_images where site_id <> ${S.birr}`;
      const [a] = await tx<{ n: number }[]>`select count(*)::int as n from public.corrective_actions where site_id <> ${S.birr}`;
      expect([f.n, i.n, a.n]).toEqual([0, 0, 0]);
    });
  });

  it("Projektleiter Tiefbau sieht keine Gesellschaftsdaten der Hochbau AG ausser Stammdaten eigener Zuordnung", async () => {
    await asUser(U.plTiefbau, async (tx) => {
      const companies = await tx<{ name: string }[]>`select name from public.companies order by name`;
      expect(companies.map((c) => c.name)).toEqual(["Beispielgesellschaft Tiefbau AG"]);
    });
  });

  it("Management sieht abgeschlossene Kontrollen, aber keine Entwürfe", async () => {
    await asUser(U.mgmt, async (tx) => {
      const rows = await tx<{ status: string; released: boolean }[]>`
        select i.status, exists (select 1 from public.generated_reports r where r.inspection_id = i.id and r.status in ('released','sent')) as released
        from public.inspections i`;
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.status !== "draft" || r.released)).toBe(true);
    });
  });

  it("Management sieht Entwürfe erst mit freigegebenem Bericht", async () => {
    await asService(async (tx) => {
      const [insp] = await tx<{ id: string }[]>`insert into public.inspections (site_id, inspector_id) values (${S.aargau}, ${U.sibe}) returning id`;
      await tx`insert into public.findings (inspection_id, title, assessment) values (${insp.id}, 'Test positiv', 'positive')`;
      await tx`select set_config('request.jwt.claim.sub', ${U.mgmt}, true)`;
      await tx.unsafe("set local role authenticated");
      expect((await tx`select id from public.inspections where id = ${insp.id}`).length).toBe(0);
      await tx.unsafe("reset role");
      await tx`insert into public.generated_reports (inspection_id, status, released_at, released_by) values (${insp.id}, 'released', now(), ${U.sibe})`;
      await tx.unsafe("set local role authenticated");
      expect((await tx`select id from public.inspections where id = ${insp.id}`).length).toBe(1);
      expect((await tx`select id from public.findings where inspection_id = ${insp.id}`).length).toBeGreaterThan(0);
    });
  });

  it("Management sieht nur freigegebene bzw. versendete Berichte", async () => {
    await asUser(U.mgmt, async (tx) => {
      const rows = await tx<{ status: string }[]>`select status from public.generated_reports`;
      expect(rows.every((r) => r.status === "released" || r.status === "sent")).toBe(true);
    });
  });

  it("Anonyme Zugriffe sind verweigert", async () => {
    await expect(asUser(null, (tx) => tx`select * from public.findings limit 1`)).rejects.toThrow(/permission denied/);
  });
});

describe("Schreibrechte", () => {
  it("Projektleiter kann auf fremder Baustelle keine Kontrolle anlegen", async () => {
    await expect(
      asUser(U.plTiefbau, (tx) => tx`insert into public.inspections (site_id, inspector_id) values (${S.birr}, ${U.plTiefbau})`),
    ).rejects.toThrow(/row-level security/);
  });

  it("Projektleiterin kann auf eigener Baustelle eine Kontrolle anlegen; Gesellschaft wird abgeleitet", async () => {
    const row = await asUser(U.plHochbau, async (tx) => {
      const [r] = await tx<{ companyId: string }[]>`insert into public.inspections (site_id, inspector_id) values (${S.birr}, ${U.plHochbau}) returning company_id`;
      return r;
    });
    const [site] = await sql<{ companyId: string }[]>`select company_id from public.construction_sites where id = ${S.birr}`;
    expect(row.companyId).toBe(site.companyId);
  });

  it("Gesellschaft muss zur Baustelle passen", async () => {
    await expect(
      asService(async (tx) => {
        const [other] = await tx<{ id: string }[]>`select id from public.companies where short_code = 'BTB'`;
        await tx`insert into public.inspections (company_id, site_id, inspector_id) values (${other.id}, ${S.birr}, ${U.sibe})`;
      }),
    ).rejects.toThrow(/gehört nicht zur gewählten Gesellschaft/);
  });

  it("Fremde Feststellungen können nicht geändert werden (0 Zeilen)", async () => {
    const count = await asUser(U.plTiefbau, async (tx) => {
      const r = await tx`update public.findings set title = 'Manipuliert' where site_id = ${S.birr}`;
      return r.count;
    });
    expect(count).toBe(0);
  });

  it("Polier darf Feststellungen nicht ändern, aber Massnahmen umsetzen", async () => {
    await asUser(U.polier, async (tx) => {
      const r = await tx`update public.findings set title = 'Polier-Änderung' where site_id = ${S.birr}`;
      expect(r.count).toBe(0);
      const [action] = await tx<{ id: string }[]>`select id from public.corrective_actions where site_id = ${S.birr} and status = 'open' limit 1`;
      const upd = await tx`update public.corrective_actions set status = 'in_progress' where id = ${action.id}`;
      expect(upd.count).toBe(1);
      await tx`insert into public.action_updates (action_id, comment, status_from, status_to) values (${action.id}, 'Material bestellt', 'open', 'in_progress')`;
    });
  });

  it("Polier darf Massnahmen nicht verifizieren", async () => {
    await expect(
      asUser(U.polier, async (tx) => {
        const [action] = await tx<{ id: string }[]>`select id from public.corrective_actions where site_id = ${S.birr} and status = 'resolved' limit 1`;
        await tx`update public.corrective_actions set status = 'verified', verification_note = 'ok' where id = ${action.id}`;
      }),
    ).rejects.toThrow(/Projektleitung bzw. SIBE vorbehalten/);
  });

  it("Polier darf Fristen nicht ändern", async () => {
    await expect(
      asUser(U.polier, async (tx) => {
        const [action] = await tx<{ id: string }[]>`select id from public.corrective_actions where site_id = ${S.birr} and status = 'open' limit 1`;
        await tx`update public.corrective_actions set due_date = due_date + 30 where id = ${action.id}`;
      }),
    ).rejects.toThrow(/Frist/);
  });

  it("Keine Rechteausweitung: Nicht-Admins können keine Rollen vergeben", async () => {
    await expect(
      asUser(U.sibe, (tx) => tx`insert into public.user_roles (user_id, role) values (${U.sibe}, 'admin')`),
    ).rejects.toThrow(/row-level security/);
  });

  it("Audit Log ist nur für Administratoren lesbar", async () => {
    const forSibe = await asUser(U.sibe, (tx) => tx`select id from public.audit_logs limit 5`);
    const forAdmin = await asUser(U.admin, (tx) => tx`select id from public.audit_logs limit 5`);
    expect(forSibe.length).toBe(0);
    expect(forAdmin.length).toBeGreaterThan(0);
  });

  it("Audit Log protokolliert Änderungen mit Akteur", async () => {
    await asUser(U.sibe, async (tx) => {
      const [f] = await tx<{ id: string }[]>`select id from public.findings where site_id = ${S.aargau} limit 1`;
      await tx`update public.findings set location = 'Testort' where id = ${f.id}`;
      await tx.unsafe("reset role");
      const [log] = await tx<{ actorId: string; action: string; changes: Record<string, unknown> }[]>`
        select actor_id, action, changes from public.audit_logs where entity_type = 'findings' and entity_id = ${f.id} order by id desc limit 1`;
      expect(log.actorId).toBe(U.sibe);
      expect(log.action).toBe("update");
      expect(log.changes).toHaveProperty("location");
    });
  });

  it("Audit Log kann von niemandem geändert werden", async () => {
    const r = await asUser(U.admin, (tx) => tx`delete from public.audit_logs`);
    expect(r.count).toBe(0);
  });
});

describe("Fachliche Constraints", () => {
  it("Kritische Abweichung erfordert verantwortliche Rolle", async () => {
    await expect(
      asUser(U.sibe, async (tx) => {
        const [i] = await tx<{ id: string }[]>`select id from public.inspections where site_id = ${S.aargau} limit 1`;
        const [c] = await tx<{ id: string }[]>`select id from public.finding_categories limit 1`;
        await tx`insert into public.findings (inspection_id, title, assessment, category_id, risk_level) values (${i.id}, 'Kritisch ohne Rolle', 'negative', ${c.id}, 'critical')`;
      }),
    ).rejects.toThrow(/findings_critical_check/);
  });

  it("Geschlossene Feststellung erfordert Abschlussinformation", async () => {
    await expect(
      asUser(U.sibe, async (tx) => {
        const [f] = await tx<{ id: string }[]>`select id from public.findings where status = 'open' limit 1`;
        await tx`update public.findings set status = 'closed' where id = ${f.id}`;
      }),
    ).rejects.toThrow(/findings_closed_check/);
  });

  it("Massnahmenstatus wird auf die Feststellung übertragen", async () => {
    await asUser(U.sibe, async (tx) => {
      const [a] = await tx<{ id: string; findingId: string }[]>`
        select a.id, a.finding_id from public.corrective_actions a
        where a.status = 'resolved' and (select count(*) from public.corrective_actions b where b.finding_id = a.finding_id) = 1 limit 1`;
      await tx`update public.corrective_actions set status = 'closed', verification_note = 'Vor Ort geprüft' where id = ${a.id}`;
      const [f] = await tx<{ status: string; closureNote: string }[]>`select status, closure_note from public.findings where id = ${a.findingId}`;
      expect(f.status).toBe("closed");
      expect(f.closureNote).toContain("Vor Ort geprüft");
    });
  });

  it("Berichtsnummer wird je Gesellschaft fortlaufend vergeben", async () => {
    await asService(async (tx) => {
      const insp = await tx<{ id: string }[]>`select id from public.inspections where site_id = ${S.zuerich} order by inspected_at limit 2`;
      const [a] = await tx<{ reportNumber: string }[]>`insert into public.generated_reports (inspection_id) values (${insp[0].id}) returning report_number`;
      const [b] = await tx<{ reportNumber: string }[]>`insert into public.generated_reports (inspection_id) values (${insp[1].id}) returning report_number`;
      expect(a.reportNumber).toMatch(/^BHB-\d{4}-\d{4}$/);
      expect(Number(b.reportNumber.slice(-4))).toBe(Number(a.reportNumber.slice(-4)) + 1);
    });
  });

  it("Versand nur für finale Berichtsversion", async () => {
    await expect(
      asService(async (tx) => {
        const [insp] = await tx<{ id: string }[]>`select id from public.inspections where site_id = ${S.zuerich} limit 1`;
        const [r] = await tx<{ id: string }[]>`insert into public.generated_reports (inspection_id) values (${insp.id}) returning id`;
        const [v] = await tx<{ id: string }[]>`insert into public.report_versions (report_id, version_no, content) values (${r.id}, 1, '{}') returning id`;
        await tx`insert into public.email_deliveries (report_id, report_version_id, to_addresses, subject, body_text, provider, sent_by)
                 values (${r.id}, ${v.id}, ${["a@b.ch"]}, 'Test', 'x', 'sandbox', ${U.sibe})`;
      }),
    ).rejects.toThrow(/finale/);
  });

  it("Storage-Policy-Helfer respektiert Baustellenzugriff", async () => {
    await asUser(U.polier, async (tx) => {
      const [own] = await tx<{ ok: boolean }[]>`select app.storage_site_readable(${`00000000-0000-0000-0000-000000000000/${S.birr}/x.jpg`}) as ok`;
      const [foreign] = await tx<{ ok: boolean }[]>`select app.storage_site_readable(${`00000000-0000-0000-0000-000000000000/${S.strasse}/x.jpg`}) as ok`;
      expect(own.ok).toBe(true);
      expect(foreign.ok).toBe(false);
    });
  });
});
