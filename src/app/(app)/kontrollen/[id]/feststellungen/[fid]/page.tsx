import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";
import { getInspection } from "@/lib/repositories/inspections";
import { getFinding, signFindingImages } from "@/lib/repositories/findings";
import { loadFindingFormData } from "@/lib/repositories/finding-form-data";
import { canEditSite } from "@/lib/domain/permissions";
import { formatDateTime } from "@/lib/utils/format";
import { PageHeader } from "@/components/ui/feedback";
import { FindingForm } from "@/components/forms/finding-form";

export const metadata: Metadata = { title: "Feststellung" };

export default async function FindingPage({ params }: PageProps<"/kontrollen/[id]/feststellungen/[fid]">) {
  const { id, fid } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(fid)) notFound();
  const user = await requireUser();
  const data = await withUser(user.id, async (tx) => {
    const inspection = await getInspection(tx, id);
    const finding = await getFinding(tx, fid);
    if (!inspection || !finding || finding.inspectionId !== id) return null;
    return { inspection, finding, ...(await loadFindingFormData(tx)) };
  });
  if (!data) notFound();
  const { inspection: i, finding: f } = data;
  const editable = canEditSite(user.permissions, i.siteId);
  const urls = await signFindingImages([f], false);
  const action = f.actions[0];
  return (
    <>
      <PageHeader
        back={<Link href={`/kontrollen/${i.id}`} className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-ink-muted hover:text-ink"><ChevronLeft className="size-4" aria-hidden /> {i.site.name}</Link>}
        title={`Feststellung ${f.number}`}
        description={`Erfasst ${formatDateTime(f.createdAt)}${f.createdByName ? ` durch ${f.createdByName}` : ""}${f.closedAt ? ` · geschlossen ${formatDateTime(f.closedAt)}` : ""}`}
      />
      <FindingForm
        readOnly={!editable}
        canDelete={editable}
        inspection={{ id: i.id, siteId: i.siteId, label: i.site.name }}
        catalog={data.catalog}
        references={data.references}
        existingImages={f.images.map((img) => ({ id: img.id, url: urls.get(img.id)!, caption: img.caption }))}
        defaults={{
          id: f.id, inspectionId: i.id, title: f.title, description: f.description ?? "", assessment: f.assessment,
          categoryId: f.categoryId ?? "", subcategoryId: f.subcategoryId ?? "", riskLevel: f.riskLevel ?? "", trade: f.trade ?? "",
          location: f.location ?? "", responsibleRole: f.responsibleRole ?? action?.responsibleRole ?? "", referenceNote: f.referenceNote ?? "",
          referenceIds: f.references.map((r) => r.id), aiReferenceIds: f.references.filter((r) => r.suggestedByAi).map((r) => r.id),
          actionDescription: action?.description ?? "", responsiblePerson: action?.responsiblePerson ?? "", dueDate: action?.dueDate ?? "",
          status: action?.status ?? null, completionNote: action?.verificationNote ?? action?.completionNote ?? "", aiSuggestionId: null, aiDecision: null,
        }}
      />
    </>
  );
}
