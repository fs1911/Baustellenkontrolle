import "server-only";
import { createElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { storage } from "@/lib/services/storage";
import type { ReportContent } from "@/lib/services/reports/model";
import { ReportDocument, type ReportAssets } from "./report-document";

/** Lädt Logo und Fotos (bereits RLS-geprüfte Pfade aus dem Snapshot) und rendert das PDF. */
export async function renderReportPdf(content: ReportContent): Promise<Buffer> {
  const assets: ReportAssets = { logo: null, images: {} };
  if (content.company.logoPath) {
    assets.logo = await storage().get("company-logos", content.company.logoPath).catch(() => null);
  }
  const paths = content.findings.flatMap((f) => f.images.map((i) => i.path));
  await Promise.all(
    paths.map(async (p) => {
      const buf = await storage().get("finding-images", p).catch(() => null);
      if (buf) assets.images[p] = buf;
    }),
  );
  const element = createElement(ReportDocument, { content, assets }) as unknown as ReactElement<DocumentProps>;
  return renderToBuffer(element);
}
