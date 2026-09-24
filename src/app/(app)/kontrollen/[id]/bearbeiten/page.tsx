import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";
import { getInspection, listTemplates } from "@/lib/repositories/inspections";
import { canEditSite } from "@/lib/domain/permissions";
import { toLocalInputValue } from "@/lib/utils/format";
import { PageHeader } from "@/components/ui/feedback";
import { InspectionForm } from "@/components/forms/inspection-form";

export const metadata: Metadata = { title: "Kontrolle bearbeiten" };

export default async function EditInspectionPage({ params }: PageProps<"/kontrollen/[id]/bearbeiten">) {
  const { id } = await params;
  const user = await requireUser();
  const data = await withUser(user.id, async (tx) => {
    const inspection = await getInspection(tx, id);
    if (!inspection) return null;
    return { inspection, templates: await listTemplates(tx) };
  });
  if (!data || !canEditSite(user.permissions, data.inspection.siteId)) notFound();
  const i = data.inspection;
  return (
    <>
      <PageHeader title="Kontrolle bearbeiten" description={`${i.site.name} · ${i.company.name}`} />
      <InspectionForm
        inspectionId={i.id}
        companies={[{ id: i.companyId, name: i.company.name, shortCode: i.company.shortCode }]}
        sites={[
          {
            id: i.siteId,
            companyId: i.companyId,
            name: i.site.name,
            siteNumber: i.site.siteNumber,
            street: i.site.street,
            postalCode: i.site.postalCode,
            city: i.site.city,
          },
        ]}
        templates={data.templates.map((t) => ({ id: t.id, name: t.name, companyId: t.companyId }))}
        creatableCompanyIds={[]}
        inspector={i.inspectorName}
        defaults={{
          companyId: i.companyId,
          siteId: i.siteId,
          inspectionType: i.inspectionType,
          inspectedAt: toLocalInputValue(new Date(i.inspectedAt)),
          weather: i.weather ?? "",
          area: i.area ?? "",
          notes: i.notes ?? "",
          templateId: i.templateId ?? "",
          participants: i.participants.map((p) => ({
            fullName: p.fullName,
            functionLabel: p.functionLabel ?? "",
            organisation: p.organisation ?? "",
          })),
        }}
      />
    </>
  );
}
