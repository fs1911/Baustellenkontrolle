import { requireUser } from "@/lib/auth/session";
import { allRoles } from "@/lib/domain/permissions";
import { ROLE_LABEL } from "@/lib/domain/enums";
import { AppShell } from "@/components/app/app-shell";
import { canQuickCreate, navItems } from "@/components/app/nav-config";
import { Providers } from "@/components/app/providers";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const roles = allRoles(user.permissions);
  const roleLabel = roles.length
    ? roles.map((r) => ROLE_LABEL[r]).join(", ")
    : user.permissions.work_site_ids.length
      ? "Baustellenzugang"
      : "Ohne Rolle";
  return (
    <Providers>
      <AppShell items={navItems(user.permissions)} user={{ name: user.fullName, roleLabel }} canCreate={canQuickCreate(user.permissions)}>
        {children}
      </AppShell>
    </Providers>
  );
}
