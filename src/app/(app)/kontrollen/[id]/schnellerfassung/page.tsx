import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";
import { getInspection, listTemplates } from "@/lib/repositories/inspections";
import { canEditSite } from "@/lib/domain/permissions";
import { formatDateTime } from "@/lib/utils/format";
import { PageHeader } from "@/components/ui/feedback";
import { QuickCapture, type QuickTemplate } from "@/components/forms/quick-capture";

export const metadata: Metadata = { title: "Schnellerfassung" };

export default async function QuickCapturePage({ params }: PageProps<"/kontrollen/[id]/schnellerfassung">) {
  const { id } = await params;
  const user = await requireUser();
  const data = await withUser(user.id, async (tx) => {
    const inspection = await getInspection(tx, id);
    if (!inspection) return null;
    const templates = await listTemplates(tx);
    const cats = await tx<{ id: string; code: string }[]>`select id, code from public.finding_categories`;
    const subs = await tx<{ id: string; code: string; sampleAction: string | null }[]>`select id, code, sample_action from public.finding_subcategories`;
    return { inspection, templates, cats, subs };
  });
  if (!data || !canEditSite(user.permissions, data.inspection.siteId)) notFound();
  const i = data.inspection;
  const tpl = data.templates.find((t) => t.id === i.templateId) ?? data.templates.find((t) => t.companyId === i.companyId) ?? data.templates.find((t) => !t.companyId);
  const quick: QuickTemplate[] = (tpl?.items ?? []).map((it) => {
    const sub = data.subs.find((s) => s.code === it.subcategoryCode);
    return {
      title: it.title,
      categoryId: data.cats.find((c) => c.code === it.categoryCode)?.id ?? null,
      subcategoryId: sub?.id ?? null,
      assessment: it.assessment,
      riskLevel: it.riskLevel,
      action: it.action ?? sub?.sampleAction ?? null,
      responsibleRole: it.responsibleRole,
    };
  });
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        back={<Link href={`/kontrollen/${i.id}`} className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-ink-muted hover:text-ink"><ChevronLeft className="size-4" aria-hidden /> Zur Kontrolle</Link>}
        title="Schnellerfassung"
      />
      <QuickCapture
        inspection={{ id: i.id, label: i.site.name, context: `${i.company.name} · ${i.site.name} (${i.site.siteNumber}) · ${formatDateTime(i.inspectedAt)} · ${user.fullName}` }}
        templates={quick}
      />
    </div>
  );
}
