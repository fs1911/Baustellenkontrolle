import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";
import { ROLE_LABEL } from "@/lib/domain/enums";
import { allRoles } from "@/lib/domain/permissions";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/feedback";
import { Tag } from "@/components/ui/badges";
import { ProfileForm } from "@/components/app/profile-form";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfilePage() {
  const user = await requireUser();
  const d = await withUser(user.id, async (tx) => {
    const [p] = await tx<{ phone: string | null }[]>`select phone from public.user_profiles where id = ${user.id}`;
    const [n] = await tx<{ emailOnAssignment: boolean; emailOnOverdue: boolean; weeklyDigest: boolean }[]>`select email_on_assignment, email_on_overdue, weekly_digest from public.notification_settings where user_id = ${user.id}`;
    return { phone: p?.phone ?? "", n: n ?? { emailOnAssignment: true, emailOnOverdue: true, weeklyDigest: false } };
  });
  return (
    <>
      <PageHeader title="Profil und Einstellungen" />
      <Card className="mb-5">
        <CardHeader title="Meine Rollen" />
        <CardBody className="flex flex-wrap gap-2">
          {allRoles(user.permissions).map((r) => <Tag key={r}>{ROLE_LABEL[r]}</Tag>)}
          <Tag>{user.permissions.work_site_ids.length} Baustelle(n) mit Zugriff</Tag>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Persönliche Angaben" />
        <CardBody><ProfileForm initial={{ fullName: user.fullName, jobTitle: user.jobTitle ?? "", phone: d.phone, email: user.businessEmail, ...d.n }} /></CardBody>
      </Card>
      <p className="mt-4 text-sm"><Link className="font-semibold underline" href="/datenschutz">Datenschutzhinweise</Link></p>
    </>
  );
}
