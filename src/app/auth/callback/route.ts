import { NextResponse } from "next/server";
import { supabaseAuthClient } from "@/lib/auth/supabase-server";
import { env } from "@/lib/env";

/** OAuth-Rückkehr (Microsoft Entra ID via Supabase Auth). */
export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  if (code && env().AUTH_PROVIDER === "supabase") {
    const supabase = await supabaseAuthClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/dashboard", env().APP_BASE_URL));
  }
  return NextResponse.redirect(new URL("/login?fehler=sso", env().APP_BASE_URL));
}
