import "server-only";
import postgres from "postgres";
import { env } from "@/lib/env";

/**
 * Datenbankzugriff.
 *
 * - `withUser` führt Abfragen in einer Transaktion mit `role authenticated` und den JWT-Claims des
 *   angemeldeten Benutzers aus – exakt wie Supabase/PostgREST. Damit greifen alle RLS-Policies.
 * - `withService` umgeht RLS und ist ausschliesslich für Systemaufgaben vorgesehen
 *   (Anmeldung, Hintergrundjobs, Versandstatus, Seed). Nie mit ungeprüften Benutzereingaben verwenden.
 */

type Sql = postgres.Sql<Record<string, never>>;
export type Tx = postgres.TransactionSql<Record<string, never>>;

const globalForDb = globalThis as unknown as { __bkSql?: Sql };

function sql(): Sql {
  if (!globalForDb.__bkSql) {
    globalForDb.__bkSql = postgres(env().DATABASE_URL, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false, // kompatibel mit Supabase Transaction Pooler (Supavisor)
      transform: postgres.camel,
      onnotice: () => {},
    }) as unknown as Sql;
  }
  return globalForDb.__bkSql;
}

export async function withUser<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const claims = JSON.stringify({ sub: userId, role: "authenticated" });
  return (await sql().begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', ${claims}, true),
                    set_config('request.jwt.claim.sub', ${userId}, true),
                    set_config('request.jwt.claim.role', 'authenticated', true)`;
    await tx.unsafe("set local role authenticated");
    return fn(tx as unknown as Tx);
  })) as T;
}

export async function withService<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return (await sql().begin(async (tx) => fn(tx as unknown as Tx))) as T;
}

/** Schliesst den Pool (Tests / Skripte). */
export async function closeDb(): Promise<void> {
  if (globalForDb.__bkSql) {
    await globalForDb.__bkSql.end({ timeout: 5 });
    globalForDb.__bkSql = undefined;
  }
}
