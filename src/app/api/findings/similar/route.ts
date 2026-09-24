import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";
import { findSimilar } from "@/lib/repositories/findings";
import { loadAnalysisFindings } from "@/lib/repositories/analysis";
import { loadSettings } from "@/lib/repositories/settings";
import { scoreFinding, type AnalysisFinding } from "@/lib/domain/recurrence";

const qSchema = z.object({
  text: z.string().max(4200).default(""),
  categoryId: z.string().uuid().optional().or(z.literal("")),
  subcategoryId: z.string().uuid().optional().or(z.literal("")),
  siteId: z.string().uuid().optional().or(z.literal("")),
  excludeId: z.string().uuid().optional().or(z.literal("")),
  riskLevel: z.string().optional(),
  responsibleRole: z.string().optional(),
  assessment: z.string().optional(),
});

/** Ähnliche frühere Feststellungen + Wiederholungs-Score für den aktuellen Entwurf (mit Kriterien). */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const q = qSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!q.success) return NextResponse.json({ similar: [], recurrence: null });
  const p = q.data;
  const result = await withUser(user.id, async (tx) => {
    const similar = await findSimilar(tx, {
      text: p.text,
      categoryId: p.categoryId || null,
      siteId: p.siteId || null,
      excludeId: p.excludeId || null,
    });
    let recurrence = null;
    if (p.siteId && (p.assessment === "negative" || p.assessment === "improvement")) {
      const settings = await loadSettings(tx);
      const history = await loadAnalysisFindings(tx, settings["recurrence.scoring"].windowDays + 1);
      const site = history.find((h) => h.siteId === p.siteId);
      const target: AnalysisFinding = {
        id: p.excludeId || "draft",
        companyId: site?.companyId ?? "",
        companyName: site?.companyName ?? "",
        siteId: p.siteId,
        siteName: site?.siteName ?? "diese Baustelle",
        projectId: site?.projectId ?? null,
        categoryId: p.categoryId || null,
        categoryName: null,
        subcategoryId: p.subcategoryId || null,
        subcategoryName: history.find((h) => h.subcategoryId === p.subcategoryId)?.subcategoryName ?? null,
        assessment: p.assessment,
        riskLevel: (["low", "medium", "high", "critical"].includes(p.riskLevel ?? "") ? p.riskLevel : null) as AnalysisFinding["riskLevel"],
        responsibleRole: p.responsibleRole || null,
        trade: null,
        title: p.text.slice(0, 200),
        description: p.text,
        status: "open",
        createdAt: new Date(),
        overdue: false,
        completedLate: false,
      };
      recurrence = scoreFinding(target, history, settings["recurrence.scoring"]);
    }
    return { similar, recurrence };
  });
  return NextResponse.json(result);
}
