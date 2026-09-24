import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { withUser } from "@/lib/db/client";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/feedback";
import { Tag } from "@/components/ui/badges";
import { CreateUserForm, UserCard, type UserRow } from "@/components/admin/user-admin";

export const metadata: Metadata = { title: "Benutzer und Rollen" };

export default async function UsersAdminPage() {
  const user = await requireAdmin();
  const d = await withUser(user.id, async (tx) => ({
    users: await tx<{ id: string; fullName: string; email: string; jobTitle: string | null; isActive: boolean }[]>`
      select id, full_name, business_email as email, job_title, is_active from public.user_profiles order by is_active desc, full_name`,
    roles: await tx<{ id: string; userId: string; role: string; companyName: string | null }[]>`
      select r.id, r.user_id, r.role, c.name as company_name from public.user_roles r left join public.companies c on c.id = r.company_id`,
    memberships: await tx<{ id: string; userId: string; siteName: string; role: string }[]>`
      select m.id, m.user_id, s.name as site_name, m.role from public.site_memberships m join public.construction_sites s on s.id = m.site_id order by s.name`,
    companies: await tx<{ id: string; name: string }[]>`select id, name from public.companies where deleted_at is null order by name`,
    sites: await tx<{ id: string; name: string }[]>`select id, name from public.construction_sites where deleted_at is null order by name`,
  }));
  const rows: UserRow[] = d.users.map((u) => ({
    ...u,
    roles: d.roles.filter((r) => r.userId === u.id),
    memberships: d.memberships.filter((m) => m.userId === u.id),
  }));
  return (
    <>
      <PageHeader
        title="Benutzer und Rollen"
        description="Rechte werden serverseitig über Rollen (gruppenweit oder je Gesellschaft) und Baustellenzuordnungen durchgesetzt."
      />
      <Card className="mb-5">
        <CardHeader
          title="Neuen Benutzer anlegen"
          description={
            env().AUTH_PROVIDER === "supabase"
              ? "Anmeldung über Supabase Auth (MFA/Microsoft Entra ID konfigurierbar)"
              : "Lokaler Entwicklungsmodus"
          }
        />
        <CardBody>
          <CreateUserForm localAuth={env().AUTH_PROVIDER === "local"} />
        </CardBody>
      </Card>
      <div className="space-y-3">
        {rows.map((u) => (
          <details key={u.id} className="group border-line rounded-[var(--radius-card)] border bg-white shadow-[var(--shadow-card)]">
            <summary className="flex min-h-14 cursor-pointer list-none flex-wrap items-center gap-2 px-5 py-2">
              <span className="font-semibold">{u.fullName}</span>
              <span className="text-ink-muted text-sm">
                {u.email}
                {u.jobTitle ? ` · ${u.jobTitle}` : ""}
              </span>
              {!u.isActive && <Tag className="text-negative">deaktiviert</Tag>}
              <Tag>{u.roles.length} Rolle(n)</Tag>
              <Tag>{u.memberships.length} Baustelle(n)</Tag>
            </summary>
            <div className="border-line border-t p-5">
              <UserCard u={u} companies={d.companies} sites={d.sites} />
            </div>
          </details>
        ))}
      </div>
    </>
  );
}
