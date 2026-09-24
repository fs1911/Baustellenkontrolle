/**
 * Wendet die SQL-Migrationen aus supabase/migrations in Reihenfolge an (lokal / CI).
 * Für gehostetes Supabase: `supabase db push` oder Supabase-MCP verwenden (siehe docs/deployment.md).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_ADMIN_URL oder DATABASE_URL fehlt");
  process.exit(1);
}

async function main() {
  const sql = postgres(url!, { max: 1, onnotice: () => {} });
  try {
    await sql`create schema if not exists app`;
    await sql`create table if not exists app.schema_migrations (
      version text primary key, applied_at timestamptz not null default now())`;
    const applied = new Set((await sql<{ version: string }[]>`select version from app.schema_migrations`).map((r) => r.version));
    const dir = join(process.cwd(), "supabase", "migrations");
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const file of files) {
      const version = file.replace(/\.sql$/, "");
      if (applied.has(version)) continue;
      const body = readFileSync(join(dir, file), "utf8");
      process.stdout.write(`→ ${file} … `);
      await sql.begin(async (tx) => {
        await tx.unsafe(body);
        await tx`insert into app.schema_migrations (version) values (${version})`;
      });
      console.log("ok");
    }
    console.log("Migrationen aktuell.");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
