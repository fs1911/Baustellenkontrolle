import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";
import { getInspection } from "@/lib/repositories/inspections";
import { loadFindingFormData } from "@/lib/repositories/finding-form-data";
import { canEditSite } from "@/lib/domain/permissions";
import { PageHeader } from "@/components/ui/feedback";
import { FindingForm } from "@/components/forms/finding-form";

export const metadata: Metadata = { title: "Feststellung erfassen" };

export default async function NewFindingPage({ params }: PageProps<"/kontrollen/[id]/feststellungen/neu">) {
  const { id } = await params;
  const user = await requireUser();
  const data = await withUser(user.id, async (tx) => {
    const inspection = await getInspection(tx, id);
    if (!inspection) return null;
    return { inspection, ...(await loadFindingFormData(tx)) };
  });
  if (!data || !canEditSite(user.permissions, data.inspection.siteId)) notFound();
  const i = data.inspection;
  return (
    <>
      <PageHeader
        back={
          <Link
            href={`/kontrollen/${i.id}`}
            className="text-ink-muted hover:text-ink inline-flex min-h-10 items-center gap-1 text-sm font-semibold"
          >
            <ChevronLeft className="size-4" aria-hidden /> {i.site.name}
          </Link>
        }
        title="Feststellung erfassen"
        description={`${i.company.name} · ${i.site.name}`}
      />
      <FindingForm
        inspection={{ id: i.id, siteId: i.siteId, label: i.site.name }}
        catalog={data.catalog}
        references={data.references}
        defaults={{
          id: null,
          inspectionId: i.id,
          title: "",
          description: "",
          assessment: undefined as never,
          categoryId: "",
          subcategoryId: "",
          riskLevel: "",
          trade: i.area ?? "",
          location: "",
          responsibleRole: "",
          referenceNote: "",
          referenceIds: [],
          aiReferenceIds: [],
          actionDescription: "",
          responsiblePerson: "",
          dueDate: "",
          status: null,
          completionNote: "",
          aiSuggestionId: null,
          aiDecision: null,
        }}
      />
    </>
  );
}
