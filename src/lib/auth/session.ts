import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { withUser } from "@/lib/db/client";
import { permissionsSchema, type Permissions } from "@/lib/domain/permissions";
import { SESSION_COOKIE, verifySessionToken } from "./session-token";
import { supabaseAuthClient } from "./supabase-server";

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  businessEmail: string;
  jobTitle: string | null;
  defaultCompanyId: string | null;
  permissions: Permissions;
}

async function resolveUserId(): Promise<string | null> {
  if (env().AUTH_PROVIDER === "supabase") {
    const supabase = await supabaseAuthClient();
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  }
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const claims = await verifySessionToken(token);
  return claims?.sub ?? null;
}

/** Liefert den angemeldeten, aktiven Benutzer inkl. Berechtigungen (pro Request gecacht). */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const userId = await resolveUserId();
  if (!userId) return null;
  return withUser(userId, async (tx) => {
    const [profile] = await tx<
      { id: string; fullName: string; businessEmail: string; jobTitle: string | null; defaultCompanyId: string | null; isActive: boolean }[]
    >`select id, full_name, business_email, job_title, default_company_id, is_active
        from public.user_profiles where id = ${userId}`;
    if (!profile || !profile.isActive) return null;
    // ::text, damit die JSON-Schlüssel nicht durch die camelCase-Transformation verändert werden
    const [{ perms }] = await tx<{ perms: string }[]>`select app.my_permissions()::text as perms`;
    const permissions = permissionsSchema.parse(JSON.parse(perms));
    return {
      id: profile.id,
      email: profile.businessEmail,
      fullName: profile.fullName,
      businessEmail: profile.businessEmail,
      jobTitle: profile.jobTitle,
      defaultCompanyId: profile.defaultCompanyId,
      permissions,
    };
  });
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export class ForbiddenError extends Error {
  constructor(message = "Für diese Aktion fehlt die Berechtigung.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.permissions.is_admin) redirect("/dashboard?fehler=keine-berechtigung");
  return user;
}

export async function requireCatalogEditor(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.permissions.is_catalog_editor) redirect("/dashboard?fehler=keine-berechtigung");
  return user;
}
