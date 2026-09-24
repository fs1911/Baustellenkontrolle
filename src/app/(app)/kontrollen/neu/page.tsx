import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";
import { listTemplates, loadInspectionTargets } from "@/lib/repositories/inspections";
import { canCreateInspections } from "@/lib/domain/permissions";
import { toLocalInputValue } from "@/lib/utils/format";
import { PageHeader } from "@/components/ui/feedback";
import { InspectionForm } from "@/components/forms/inspection-form";

export const metadata: Metadata = { title: "Neue Kontrolle" };

export default async function NewInspectionPage() {
  const user = await requireUser();
  const p = user.permissions;
  const creatableCompanyIds = Array.from(new Set([...p.manageable_company_ids, ...p.company_roles.filter((r) => r.role === "project_manager").map((r) => r.company_id)]));
  if (!canCreateInspections(p) && creatableCompanyIds.length === 0) redirect("/kontrollen");
  const { sites, companies, templates } = await withUser(user.id, async (tx) => ({
    ...(await loadInspectionTargets(tx, p.edit_site_ids)),
    templates: await listTemplates(tx),
  }));
  const defaultCompany = companies.find((c) => c.id === user.defaultCompanyId && (sites.some((s) => s.companyId === c.id) || creatableCompanyIds.includes(c.id)));
  return (
    <>
      <PageHeader title="Neue Kontrolle" description="Gesellschaft und Baustelle wählen, danach Feststellungen erfassen." />
      <InspectionForm
        companies={companies}
        sites={sites}
        templates={templates.map((t) => ({ id: t.id, name: t.name, companyId: t.companyId }))}
        creatableCompanyIds={creatableCompanyIds}
        inspector={user.fullName}
        defaults={{
          companyId: defaultCompany?.id ?? "",
          siteId: "",
          inspectionType: "routine",
          inspectedAt: toLocalInputValue(new Date()),
          weather: "",
          area: "",
          notes: "",
          templateId: templates.find((t) => !t.companyId)?.id ?? "",
          participants: [],
        }}
      />
    </>
  );
}
