import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";

/** Supabase-Auth-Client (nur bei AUTH_PROVIDER=supabase). Unterstützt Passwort, MFA und Entra ID (Azure). */
export async function supabaseAuthClient() {
  const e = env();
  const store = await cookies();
  return createServerClient(e.NEXT_PUBLIC_SUPABASE_URL!, e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (items) => {
        try {
          for (const { name, value, options } of items) store.set(name, value, options);
        } catch {
          // In Server Components nicht setzbar – der Proxy aktualisiert die Sitzung.
        }
      },
    },
  });
}
