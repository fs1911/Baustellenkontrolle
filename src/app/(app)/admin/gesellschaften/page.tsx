import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";
import { storage } from "@/lib/services/storage";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/feedback";
import { CompanyEditor, type CompanyData } from "@/components/admin/company-editor";

export const metadata: Metadata = { title: "Gesellschaften" };

export default async function CompaniesAdminPage() {
  const user = await requireAdmin();
  const rows = await withUser(user.id, (tx) => tx<{ id: string; name: string; shortCode: string; street: string | null; postalCode: string | null; city: string | null; primaryColor: string | null; emailSenderName: string | null; defaultDistribution: string[]; reportDisclaimer: string | null; confidentialityNote: string | null; isActive: boolean; logoPath: string | null }[]>`
    select c.*, (select l.storage_path from public.company_logos l where l.company_id = c.id and l.is_active limit 1) as logo_path
    from public.companies c where c.deleted_at is null order by c.name`);
  const data: CompanyData[] = await Promise.all(rows.map(async (r) => ({
    id: r.id, name: r.name, shortCode: r.shortCode, street: r.street ?? "", postalCode: r.postalCode ?? "", city: r.city ?? "",
    primaryColor: r.primaryColor ?? "", emailSenderName: r.emailSenderName ?? "", defaultDistribution: r.defaultDistribution.join(", "),
    reportDisclaimer: r.reportDisclaimer ?? "", confidentialityNote: r.confidentialityNote ?? "", isActive: r.isActive,
    logoUrl: r.logoPath ? await storage().signedUrl("company-logos", r.logoPath) : null,
  })));
  return (
    <>
      <PageHeader title="Gesellschaften, Logos und Branding" description="Das aktive Logo und die Markenfarbe werden automatisch in Berichten und E-Mails der Gesellschaft verwendet." />
      <div className="space-y-4">
        {data.map((c) => (
          <details key={c.id} className="group rounded-[var(--radius-card)] border border-line bg-white shadow-[var(--shadow-card)]">
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {c.logoUrl && <img src={c.logoUrl} alt="" className="h-8 w-auto" />}
              <span className="font-semibold">{c.name}</span><span className="text-sm text-ink-muted">{c.shortCode}</span>
              <span className="ml-auto text-sm text-info group-open:hidden">bearbeiten</span>
            </summary>
            <div className="border-t border-line p-5"><CompanyEditor initial={c} /></div>
          </details>
        ))}
        <Card>
          <CardHeader title="Neue Gesellschaft" />
          <CardBody>
            <CompanyEditor initial={{ id: null, name: "", shortCode: "", street: "", postalCode: "", city: "", primaryColor: "", emailSenderName: "", defaultDistribution: "", reportDisclaimer: "", confidentialityNote: "", isActive: true, logoUrl: null }} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
