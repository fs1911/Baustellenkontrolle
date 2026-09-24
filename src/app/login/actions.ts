"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { env } from "@/lib/env";
import { withService, withUser } from "@/lib/db/client";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/auth/session-token";
import { supabaseAuthClient } from "@/lib/auth/supabase-server";
import { checkRateLimit, resetRateLimit } from "@/lib/auth/rate-limit";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Bitte eine gültige E-Mail-Adresse eingeben."),
  password: z.string().min(1, "Bitte das Passwort eingeben.").max(200),
  next: z.string().optional(),
});

export interface LoginState {
  error?: string;
  email?: string;
}

function safeNext(next: string | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message, email: String(formData.get("email") ?? "") };
  const { email, password, next } = parsed.data;
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const limit = checkRateLimit(`${email}|${ip}`);
  if (!limit.allowed) {
    return { error: `Zu viele Anmeldeversuche. Bitte in ${limit.retryInMinutes} Minuten erneut versuchen.`, email };
  }

  let userId: string | null = null;
  if (env().AUTH_PROVIDER === "supabase") {
    const supabase = await supabaseAuthClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return { error: "E-Mail-Adresse oder Passwort ist nicht korrekt.", email };
    userId = data.user.id;
  } else {
    userId = await withService(async (tx) => {
      const [row] = await tx<{ id: string }[]>`
        select u.id from auth.users u
        join public.user_profiles p on p.id = u.id and p.is_active
        where lower(u.email) = ${email} and u.encrypted_password is not null
          and u.encrypted_password = extensions.crypt(${password}, u.encrypted_password)`;
      return row?.id ?? null;
    });
    if (!userId) return { error: "E-Mail-Adresse oder Passwort ist nicht korrekt.", email };
    const token = await createSessionToken({ sub: userId, email });
    (await cookies()).set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: env().APP_BASE_URL.startsWith("https://"),
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
  }
  resetRateLimit(`${email}|${ip}`);
  await withUser(
    userId,
    (tx) => tx`select app.log_event('session', ${userId}, 'login', null, ${tx.json({ provider: env().AUTH_PROVIDER })})`,
  );
  redirect(safeNext(next));
}

export async function loginWithMicrosoftAction(): Promise<void> {
  if (env().AUTH_PROVIDER !== "supabase" || env().AUTH_ENABLE_AZURE !== "true") redirect("/login");
  const supabase = await supabaseAuthClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "azure",
    options: { scopes: "email openid profile", redirectTo: `${env().APP_BASE_URL}/auth/callback` },
  });
  if (error || !data.url) redirect("/login?fehler=sso");
  redirect(data.url);
}

export async function logoutAction(): Promise<void> {
  if (env().AUTH_PROVIDER === "supabase") {
    const supabase = await supabaseAuthClient();
    await supabase.auth.signOut();
  }
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
