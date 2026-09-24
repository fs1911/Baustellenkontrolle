import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";
import { renderReportPdf } from "@/lib/services/pdf/render";
import { previewContent } from "@/lib/services/reports/service";
import type { ReportContent } from "@/lib/services/reports/model";
import { storage } from "@/lib/services/storage";

/**
 * PDF eines Berichts:
 *  - ?version=<id>  → gespeicherte Version (final: archiviertes PDF, sonst aus Snapshot gerendert)
 *  - ohne Parameter → Live-Vorschau des aktuellen Stands (Entwurf)
 * Zugriff ausschliesslich über RLS-geprüfte Abfragen.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/reports/[inspectionId]/pdf">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const { inspectionId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(inspectionId)) return new Response("Ungültig", { status: 400 });
  const versionId = new URL(request.url).searchParams.get("version");
  const download = new URL(request.url).searchParams.get("download") === "1";

  let pdf: Buffer | null = null;
  let filename = "Baustellenkontrollbericht-Entwurf.pdf";
  if (versionId && /^[0-9a-f-]{36}$/i.test(versionId)) {
    const v = await withUser(user.id, async (tx) => {
      const [row] = await tx<{ id: string; isFinal: boolean; pdfPath: string | null; content: ReportContent; companyId: string }[]>`
        select v.id, v.is_final, v.pdf_path, v.content, v.company_id from public.report_versions v
        join public.generated_reports r on r.id = v.report_id
        where v.id = ${versionId} and r.inspection_id = ${inspectionId}`;
      if (row) await tx`select app.log_event('report_versions', ${row.id}, 'download', ${row.companyId}, null)`;
      return row;
    });
    if (!v) return new Response("Nicht gefunden oder keine Berechtigung", { status: 404 });
    filename = `${v.content.reportNumber}-v${v.content.versionNo}.pdf`;
    pdf = v.isFinal && v.pdfPath ? await storage().get("generated-reports", v.pdfPath) : await renderReportPdf(v.content);
  } else {
    const built = await previewContent(user, inspectionId);
    if (!built) return new Response("Nicht gefunden oder keine Berechtigung", { status: 404 });
    pdf = await renderReportPdf({ ...built.content, status: built.content.status === "sent" ? "sent" : "draft" });
  }
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
