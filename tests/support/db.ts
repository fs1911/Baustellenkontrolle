import postgres from "postgres";

export const TEST_DB_URL = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:54322/postgres";

export const sql = postgres(TEST_DB_URL, { max: 4, transform: postgres.camel, onnotice: () => {} });

class Rollback extends Error {}

/** Führt fn als Benutzer (role authenticated + JWT-Claims) aus und rollt danach immer zurück. */
export async function asUser<T>(userId: string | null, fn: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
  let result: T | undefined;
  try {
    await sql.begin(async (tx) => {
      if (userId) {
        await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: "authenticated" })}, true),
                        set_config('request.jwt.claim.sub', ${userId}, true)`;
        await tx.unsafe("set local role authenticated");
      } else {
        await tx.unsafe("set local role anon");
      }
      result = await fn(tx);
      throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
  return result as T;
}

/** Wie asUser, aber als Systemrolle (RLS umgangen) – für Testvorbereitung innerhalb derselben Transaktion. */
export async function asService<T>(fn: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
  let result: T | undefined;
  try {
    await sql.begin(async (tx) => {
      result = await fn(tx);
      throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
  return result as T;
}

export async function userId(email: string): Promise<string> {
  const [row] = await sql<{ id: string }[]>`select id from public.user_profiles where business_email = ${email}`;
  if (!row) throw new Error(`Testbenutzer ${email} fehlt – bitte zuerst "npm run db:seed" ausführen.`);
  return row.id;
}

export async function siteId(name: string): Promise<string> {
  const [row] = await sql<{ id: string }[]>`select id from public.construction_sites where name = ${name}`;
  return row.id;
}
