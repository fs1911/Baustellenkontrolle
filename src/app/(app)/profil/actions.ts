"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";
import { toUserError, type ActionResult } from "@/lib/utils/errors";

const schema = z.object({
  fullName: z.string().trim().min(2).max(120),
  jobTitle: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => v || null),
  phone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => v || null),
  emailOnAssignment: z.boolean(),
  emailOnOverdue: z.boolean(),
  weeklyDigest: z.boolean(),
});

export async function saveProfileAction(input: z.input<typeof schema>): Promise<ActionResult> {
  const user = await requireUser();
  try {
    const d = schema.parse(input);
    await withUser(user.id, async (tx) => {
      await tx`update public.user_profiles set full_name = ${d.fullName}, job_title = ${d.jobTitle}, phone = ${d.phone} where id = ${user.id}`;
      await tx`insert into public.notification_settings (user_id, email_on_assignment, email_on_overdue, weekly_digest)
               values (${user.id}, ${d.emailOnAssignment}, ${d.emailOnOverdue}, ${d.weeklyDigest})
               on conflict (user_id) do update set email_on_assignment = excluded.email_on_assignment,
                 email_on_overdue = excluded.email_on_overdue, weekly_digest = excluded.weekly_digest`;
    });
    revalidatePath("/profil");
    return { ok: true, data: undefined, message: "Profil gespeichert." };
  } catch (err) {
    return toUserError(err);
  }
}

/** Auskunft (Art. 25 DSG): eigene Personendaten als JSON. */
export async function exportMyDataAction(): Promise<ActionResult<string>> {
  const user = await requireUser();
  const data = await withUser(user.id, async (tx) => ({
    profile: await tx`select full_name, business_email, job_title, phone, created_at from public.user_profiles where id = ${user.id}`,
    roles: await tx`select role, company_id from public.user_roles where user_id = ${user.id}`,
    memberships: await tx`select site_id, role from public.site_memberships where user_id = ${user.id}`,
    inspections: await tx`select id, inspected_at, site_id from public.inspections where inspector_id = ${user.id}`,
    findingsCreated: await tx`select id, title, created_at from public.findings where created_by = ${user.id}`,
    emailsSent: await tx`select id, subject, sent_at, to_addresses from public.email_deliveries where sent_by = ${user.id}`,
  }));
  return { ok: true, data: JSON.stringify(data, null, 2) };
}
