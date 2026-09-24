import { createElement, type ReactElement } from "react";
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { getCurrentUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";
import { canSeeGroupAnalytics, hasAnyRole } from "@/lib/domain/permissions";
import { loadManagementData } from "@/lib/repositories/management";
import { searchFindings } from "@/lib/repositories/findings";
import { ACTION_STATUS_LABEL, ASSESSMENT_LABEL, RISK_LABEL } from "@/lib/domain/enums";
import { parseDashboardFilters } from "@/lib/utils/dashboard-params";
import { ManagementDocument } from "@/lib/services/pdf/management-document";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  if (!canSeeGroupAnalytics(user.permissions) && !hasAnyRole(user.permissions, ["viewer", "admin", "group_ims"])) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "pdf";
  const f = parseDashboardFilters(Object.fromEntries(url.searchParams), 365);
  const { d, findings } = await withUser(user.id, async (tx) => {
    await tx`select app.log_event('export', ${format}, 'export', ${f.companyId ?? null}, ${tx.json({ from: f.from, to: f.to })})`;
    return { d: await loadManagementData(tx, f), findings: format === "xlsx" ? await searchFindings(tx, { companyId: f.companyId, from: f.from, to: f.to }, 5000) : [] };
  });
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "pdf") {
    const pdf = await renderToBuffer(createElement(ManagementDocument, { d }) as unknown as ReactElement<DocumentProps>);
    return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="Management-Uebersicht_${stamp}.pdf"` } });
  }
  const wb = new ExcelJS.Workbook();
  wb.creator = "Baustellenkontrolle";
  const add = (name: string, columns: { header: string; key: string; width: number }[], rows: Record<string, unknown>[]) => {
    const ws = wb.addWorksheet(name);
    ws.columns = columns;
    ws.addRows(rows);
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
  };
  const k = d.kpis;
  add("Kennzahlen", [{ header: "Kennzahl", key: "k", width: 36 }, { header: "Wert", key: "v", width: 16 }], [
    { k: "Zeitraum", v: `${f.from} – ${f.to}` }, { k: "Kontrollen", v: k.inspections }, { k: "Feststellungen", v: k.findings }, { k: "Positiv", v: k.positive },
    { k: "Abweichungen", v: k.negative }, { k: "Verbesserungsmöglichkeiten", v: k.improvement }, { k: "Kritische Abweichungen", v: k.criticalDeviations },
    { k: "Offene Massnahmen", v: k.openActions }, { k: "Überfällige Massnahmen", v: k.overdueActions }, { k: "Erledigungsquote", v: k.completionRate },
    { k: "Ø Tage bis Erledigung", v: k.avgDaysToCompletion }, { k: "Abweichungen Vorperiode", v: k.deviationsPrev },
  ]);
  add("Gesellschaften", [
    { header: "Gesellschaft", key: "name", width: 36 }, { header: "Kontrollen", key: "inspections", width: 12 }, { header: "Feststellungen", key: "findings", width: 14 },
    { header: "Positiv", key: "positive", width: 10 }, { header: "Abweichungen", key: "deviations", width: 14 }, { header: "Kritisch offen", key: "criticalOpen", width: 14 },
    { header: "Überfällig", key: "overdue", width: 12 }, { header: "Erledigungsquote", key: "completionRate", width: 16 }, { header: "Ø Tage", key: "avgDays", width: 10 },
  ], d.companies as unknown as Record<string, unknown>[]);
  add("Monatsverlauf", [{ header: "Monat", key: "label", width: 12 }, { header: "Offen", key: "open", width: 10 }, { header: "Überfällig", key: "overdue", width: 12 }], d.months as unknown as Record<string, unknown>[]);
  add("Systemische Themen", [{ header: "Thema", key: "title", width: 50 }, { header: "Score", key: "score", width: 8 }, { header: "Hinweis", key: "insight", width: 90 }, { header: "Empfehlung", key: "recommendation", width: 80 }], d.themes as unknown as Record<string, unknown>[]);
  add("Feststellungen", [
    { header: "Datum", key: "date", width: 12 }, { header: "Gesellschaft", key: "companyName", width: 30 }, { header: "Baustelle", key: "siteName", width: 32 },
    { header: "Titel", key: "title", width: 50 }, { header: "Beurteilung", key: "assessment", width: 22 }, { header: "Kategorie", key: "categoryName", width: 34 },
    { header: "Risiko", key: "risk", width: 10 }, { header: "Status", key: "status", width: 14 }, { header: "Überfällig", key: "overdue", width: 10 },
  ], findings.map((r) => ({ ...r, date: new Date(r.createdAt).toISOString().slice(0, 10), assessment: ASSESSMENT_LABEL[r.assessment], risk: r.riskLevel ? RISK_LABEL[r.riskLevel] : "", status: r.status ? ACTION_STATUS_LABEL[r.status] : "", overdue: r.overdue ? "ja" : "" })));
  const buf = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buf as ArrayBuffer), {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="Management-Uebersicht_${stamp}.xlsx"` },
  });
}
