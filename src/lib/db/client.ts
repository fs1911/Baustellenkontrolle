import "server-only";
import postgres from "postgres";
import { env } from "@/lib/env";
import { parseConnectionString } from "./connection-string";

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

/**
 * Cloudflare Workers erlauben keine I/O-Objekte (Sockets) über Anfragegrenzen hinweg.
 * Dort wird pro Transaktion eine eigene Verbindung geöffnet und danach geschlossen
 * (mit Hyperdrive oder dem Supabase-Pooler ist das günstig).
 */
const isWorkers = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

function connect(max: number): Sql {
  const c = parseConnectionString(env().DATABASE_URL);
  return postgres({
    host: c.host,
    port: c.port,
    database: c.database,
    username: c.username,
    password: c.password,
    ssl: c.ssl ? "require" : false,
    max,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false, // kompatibel mit Supabase Transaction Pooler (Supavisor)
    transform: postgres.camel,
    onnotice: () => {},
  }) as unknown as Sql;
}

async function run<T>(fn: (sql: Sql) => Promise<T>): Promise<T> {
  if (isWorkers) {
    const sql = connect(1);
    try {
      return await fn(sql);
    } finally {
      await sql.end({ timeout: 2 });
    }
  }
  globalForDb.__bkSql ??= connect(10);
  return fn(globalForDb.__bkSql);
}

export async function withUser<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const claims = JSON.stringify({ sub: userId, role: "authenticated" });
  return run(
    async (sql) =>
      (await sql.begin(async (tx) => {
        await tx`select set_config('request.jwt.claims', ${claims}, true),
                    set_config('request.jwt.claim.sub', ${userId}, true),
                    set_config('request.jwt.claim.role', 'authenticated', true)`;
        await tx.unsafe("set local role authenticated");
        return fn(tx as unknown as Tx);
      })) as T,
  );
}

export async function withService<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return run(async (sql) => (await sql.begin(async (tx) => fn(tx as unknown as Tx))) as T);
}

/** Schliesst den Pool (Tests / Skripte). */
export async function closeDb(): Promise<void> {
  if (globalForDb.__bkSql) {
    await globalForDb.__bkSql.end({ timeout: 5 });
    globalForDb.__bkSql = undefined;
  }
}
