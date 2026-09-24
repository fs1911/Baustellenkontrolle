"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { withService, withUser } from "@/lib/db/client";
import { env } from "@/lib/env";
import { APP_ROLES, REFERENCE_TYPES, RISK_LEVELS } from "@/lib/domain/enums";
import { settingsSchemas, type SettingsKey } from "@/lib/domain/settings";
import { runRetention } from "@/lib/services/retention";
import { toUserError, type ActionResult } from "@/lib/utils/errors";

const emailList = z.array(z.string().trim().toLowerCase().email("Ungültige E-Mail-Adresse")).max(20);
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => v || null);

async function admin() {
  const user = await requireUser();
  if (!user.permissions.is_admin) throw Object.assign(new Error("Nur für Administratoren."), { name: "ForbiddenError" });
  return user;
}
async function catalogEditor() {
  const user = await requireUser();
  if (!user.permissions.is_catalog_editor)
    throw Object.assign(new Error("Nur für Administration und Gruppen-IMS/SIBE."), { name: "ForbiddenError" });
  return user;
}

// --- Gesellschaften -----------------------------------------------------------
const companySchema = z.object({
  id: z.string().uuid().optional().nullable(),
  name: z.string().trim().min(2, "Firmenname erforderlich").max(160),
  shortCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,8}$/, "2–8 Grossbuchstaben/Ziffern"),
  street: optText(200),
  postalCode: optText(10),
  city: optText(100),
  primaryColor: z
    .union([z.string().regex(/^#[0-9a-fA-F]{6}$/, "Format #RRGGBB"), z.literal(""), z.null()])
    .optional()
    .transform((v) => v || null),
  emailSenderName: optText(120),
  defaultDistribution: emailList,
  reportDisclaimer: optText(3000),
  confidentialityNote: optText(500),
  isActive: z.boolean().default(true),
});

export async function saveCompanyAction(input: z.input<typeof companySchema>): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await admin();
    const d = companySchema.parse(input);
    const { id: existingId, ...values } = d;
    const id = await withUser(user.id, async (tx) => {
      if (existingId) {
        await tx`update public.companies set ${tx(values)} where id = ${existingId}`;
        return existingId;
      }
      const [r] = await tx<{ id: string }[]>`insert into public.companies ${tx(values)} returning id`;
      return r.id;
    });
    revalidatePath("/admin/gesellschaften");
    return { ok: true, data: { id }, message: "Gesellschaft gespeichert." };
  } catch (err) {
    return toUserError(err);
  }
}

// --- Katalog ------------------------------------------------------------------
const keywords = z.string().transform((s) =>
  Array.from(
    new Set(
      s
        .split(/[,;\n]+/)
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean),
    ),
  ).slice(0, 60),
);

const categorySchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(160),
  description: optText(1000),
  defaultRisk: z.enum(RISK_LEVELS),
  keywords,
  internalRule: optText(500),
  sampleAction: optText(1000),
  isActive: z.boolean(),
});

export async function saveCategoryAction(input: z.input<typeof categorySchema>): Promise<ActionResult> {
  try {
    const user = await catalogEditor();
    const { id, ...v } = categorySchema.parse(input);
    await withUser(user.id, (tx) => tx`update public.finding_categories set ${tx(v)} where id = ${id}`);
    revalidatePath("/admin/katalog");
    return { ok: true, data: undefined, message: "Kategorie gespeichert." };
  } catch (err) {
    return toUserError(err);
  }
}

const subcategorySchema = z.object({
  id: z.string().uuid().optional().nullable(),
  categoryId: z.string().uuid(),
  code: z
    .string()
    .trim()
    .regex(/^[a-z0-9_.]{3,60}$/, "Code: Kleinbuchstaben, Ziffern, Punkt"),
  name: z.string().trim().min(2).max(160),
  defaultRisk: z.union([z.enum(RISK_LEVELS), z.literal("")]).transform((v) => v || null),
  keywords,
  sampleAction: optText(1000),
  isActive: z.boolean(),
});

export async function saveSubcategoryAction(input: z.input<typeof subcategorySchema>): Promise<ActionResult> {
  try {
    const user = await catalogEditor();
    const { id, ...v } = subcategorySchema.parse(input);
    await withUser(user.id, (tx) =>
      id ? tx`update public.finding_subcategories set ${tx(v)} where id = ${id}` : tx`insert into public.finding_subcategories ${tx(v)}`,
    );
    revalidatePath("/admin/katalog");
    return { ok: true, data: undefined, message: "Unterkategorie gespeichert." };
  } catch (err) {
    return toUserError(err);
  }
}

const referenceSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  referenceType: z.enum(REFERENCE_TYPES),
  code: z.string().trim().min(2).max(160),
  title: z.string().trim().min(2).max(300),
  description: optText(3000),
  url: z
    .union([z.string().trim().url("Gültige URL (https://)").startsWith("https://", "Nur https-Links"), z.literal("")])
    .optional()
    .transform((v) => v || null),
  source: optText(200),
  retrievedAt: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")])
    .optional()
    .transform((v) => v || null),
  sourceVersion: optText(100),
  categoryIds: z.array(z.string().uuid()).default([]),
});

/**
 * Referenzänderungen erzeugen immer eine neue Version (Status "zu prüfen"); die Vorversion wird
 * deaktiviert. So bleibt nachvollziehbar, welche Fassung in früheren Berichten verwendet wurde.
 */
export async function saveReferenceAction(input: z.input<typeof referenceSchema>): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await catalogEditor();
    const { id, categoryIds, ...v } = referenceSchema.parse(input);
    const newId = await withUser(user.id, async (tx) => {
      let versionNo = 1;
      if (id) {
        const [old] = await tx<{ versionNo: number }[]>`select version_no from public.legal_references where id = ${id}`;
        versionNo = (old?.versionNo ?? 0) + 1;
        await tx`update public.legal_references set is_active = false where id = ${id}`;
      }
      const [r] = await tx<
        { id: string }[]
      >`insert into public.legal_references ${tx({ ...v, versionNo, supersedesId: id ?? null, reviewStatus: "to_review" })} returning id`;
      for (const categoryId of categoryIds) {
        await tx`insert into public.category_reference_mappings (category_id, legal_reference_id) values (${categoryId}, ${r.id}) on conflict do nothing`;
      }
      return r.id;
    });
    revalidatePath("/admin/katalog");
    return {
      ok: true,
      data: { id: newId },
      message: id ? "Neue Version angelegt (Status: zu prüfen)." : "Referenz angelegt (Status: zu prüfen).",
    };
  } catch (err) {
    return toUserError(err);
  }
}

export async function reviewReferenceAction(input: {
  id: string;
  decision: "approved" | "retired" | "to_review";
  note?: string;
}): Promise<ActionResult> {
  try {
    const user = await catalogEditor();
    const d = z
      .object({ id: z.string().uuid(), decision: z.enum(["approved", "retired", "to_review"]), note: z.string().max(1000).optional() })
      .parse(input);
    await withUser(
      user.id,
      (tx) => tx`
      update public.legal_references set review_status = ${d.decision}, review_note = ${d.note || null},
        reviewed_by = case when ${d.decision} = 'to_review' then null else app.uid() end,
        reviewed_at = case when ${d.decision} = 'to_review' then null else now() end,
        is_active = ${d.decision !== "retired"}
      where id = ${d.id}`,
    );
    revalidatePath("/admin/katalog");
    return {
      ok: true,
      data: undefined,
      message:
        d.decision === "approved"
          ? "Referenz freigegeben."
          : d.decision === "retired"
            ? "Referenz ausser Kraft gesetzt."
            : "Zur Prüfung zurückgesetzt.",
    };
  } catch (err) {
    return toUserError(err);
  }
}

export async function setMappingsAction(referenceId: string, categoryIds: string[]): Promise<ActionResult> {
  try {
    const user = await catalogEditor();
    const ids = z.array(z.string().uuid()).parse(categoryIds);
    await withUser(user.id, async (tx) => {
      await tx`delete from public.category_reference_mappings where legal_reference_id = ${z.string().uuid().parse(referenceId)} and not (category_id = any(${ids}::uuid[]))`;
      for (const c of ids)
        await tx`insert into public.category_reference_mappings (category_id, legal_reference_id) values (${c}, ${referenceId}) on conflict do nothing`;
    });
    revalidatePath("/admin/katalog");
    return { ok: true, data: undefined, message: "Zuordnung gespeichert." };
  } catch (err) {
    return toUserError(err);
  }
}

// --- Benutzer -----------------------------------------------------------------
const newUserSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  jobTitle: optText(120),
  password: z.string().min(12, "Mindestens 12 Zeichen").max(200).optional().or(z.literal("")),
});

/** Benutzer anlegen. Lokal: mit Initialpasswort. Supabase: Einladung per E-Mail über Supabase Auth Admin API. */
export async function createUserAction(input: z.input<typeof newUserSchema>): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await admin();
    const d = newUserSchema.parse(input);
    let id: string;
    if (env().AUTH_PROVIDER === "supabase") {
      const { createClient } = await import("@supabase/supabase-js");
      const sb = createClient(env().NEXT_PUBLIC_SUPABASE_URL!, env().SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
      const { data, error } = await sb.auth.admin.inviteUserByEmail(d.email, { data: { full_name: d.fullName } });
      if (error || !data.user) return { ok: false, error: `Einladung fehlgeschlagen: ${error?.message ?? "unbekannt"}` };
      id = data.user.id;
    } else {
      if (!d.password)
        return { ok: false, error: "Im lokalen Modus ist ein Initialpasswort erforderlich.", fieldErrors: { password: "Erforderlich" } };
      id = await withService(async (tx) => {
        const [r] = await tx<{ id: string }[]>`
          insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
          values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', ${d.email},
                  extensions.crypt(${d.password!}, extensions.gen_salt('bf')), '{"provider":"email","providers":["email"]}'::jsonb,
                  ${tx.json({ full_name: d.fullName })}, now(), now()) returning id`;
        return r.id;
      });
    }
    await withUser(
      user.id,
      (tx) =>
        tx`insert into public.user_profiles (id, full_name, business_email, job_title) values (${id}, ${d.fullName}, ${d.email}, ${d.jobTitle})`,
    );
    revalidatePath("/admin/benutzer");
    return { ok: true, data: { id }, message: "Benutzer angelegt." };
  } catch (err) {
    return toUserError(err);
  }
}

export async function addRoleAction(input: { userId: string; role: string; companyId: string | null }): Promise<ActionResult> {
  try {
    const user = await admin();
    const d = z.object({ userId: z.string().uuid(), role: z.enum(APP_ROLES), companyId: z.string().uuid().nullable() }).parse(input);
    await withUser(
      user.id,
      (tx) => tx`insert into public.user_roles (user_id, role, company_id) values (${d.userId}, ${d.role}, ${d.companyId})`,
    );
    revalidatePath("/admin/benutzer");
    return { ok: true, data: undefined, message: "Rolle zugewiesen." };
  } catch (err) {
    return toUserError(err);
  }
}

export async function removeRoleAction(roleId: string): Promise<ActionResult> {
  try {
    const user = await admin();
    await withUser(user.id, async (tx) => {
      const [r] = await tx<
        { userId: string; role: string }[]
      >`select user_id, role from public.user_roles where id = ${z.string().uuid().parse(roleId)}`;
      if (r?.userId === user.id && r.role === "admin")
        throw Object.assign(new Error("Die eigene Administratorrolle kann nicht entfernt werden."), { name: "ForbiddenError" });
      await tx`delete from public.user_roles where id = ${roleId}`;
    });
    revalidatePath("/admin/benutzer");
    return { ok: true, data: undefined, message: "Rolle entfernt." };
  } catch (err) {
    return toUserError(err);
  }
}

export async function addMembershipAction(input: { userId: string; siteId: string; role: string }): Promise<ActionResult> {
  try {
    const user = await admin();
    const d = z
      .object({ userId: z.string().uuid(), siteId: z.string().uuid(), role: z.enum(["project_manager", "site_foreman", "viewer"]) })
      .parse(input);
    await withUser(
      user.id,
      (tx) =>
        tx`insert into public.site_memberships (user_id, site_id, role) values (${d.userId}, ${d.siteId}, ${d.role}) on conflict do nothing`,
    );
    revalidatePath("/admin/benutzer");
    return { ok: true, data: undefined, message: "Baustelle zugeordnet." };
  } catch (err) {
    return toUserError(err);
  }
}

export async function removeMembershipAction(id: string): Promise<ActionResult> {
  try {
    const user = await admin();
    await withUser(user.id, (tx) => tx`delete from public.site_memberships where id = ${z.string().uuid().parse(id)}`);
    revalidatePath("/admin/benutzer");
    return { ok: true, data: undefined, message: "Zuordnung entfernt." };
  } catch (err) {
    return toUserError(err);
  }
}

export async function setUserActiveAction(userId: string, active: boolean): Promise<ActionResult> {
  try {
    const user = await admin();
    if (userId === user.id) return { ok: false, error: "Das eigene Konto kann nicht deaktiviert werden." };
    await withUser(
      user.id,
      (tx) => tx`update public.user_profiles set is_active = ${active} where id = ${z.string().uuid().parse(userId)}`,
    );
    revalidatePath("/admin/benutzer");
    return { ok: true, data: undefined, message: active ? "Benutzer aktiviert." : "Benutzer deaktiviert." };
  } catch (err) {
    return toUserError(err);
  }
}

// --- Einstellungen ------------------------------------------------------------
export async function saveSettingAction(key: SettingsKey, value: unknown): Promise<ActionResult> {
  try {
    const user = await admin();
    const schema = settingsSchemas[key];
    if (!schema) return { ok: false, error: "Unbekannte Einstellung." };
    const parsed = schema.parse(value);
    await withUser(
      user.id,
      (tx) => tx`
      insert into public.system_settings (key, value) values (${key}, ${tx.json(parsed as never)})
      on conflict (key) do update set value = excluded.value`,
    );
    revalidatePath("/admin/einstellungen");
    return { ok: true, data: undefined, message: "Einstellung gespeichert." };
  } catch (err) {
    return toUserError(err);
  }
}

export async function retentionAction(execute: boolean): Promise<ActionResult<Awaited<ReturnType<typeof runRetention>>>> {
  try {
    const user = await admin();
    const r = await runRetention({ execute, actorId: user.id });
    return { ok: true, data: r, message: execute ? "Löschlauf ausgeführt." : "Trockenlauf abgeschlossen." };
  } catch (err) {
    return toUserError(err);
  }
}
