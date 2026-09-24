import { describe, expect, it } from "vitest";
import { ConnectionStringError, parseConnectionString } from "@/lib/db/connection-string";

describe("DATABASE_URL tolerant lesen", () => {
  it("liest eine normale Supabase-Pooler-Adresse", () => {
    const c = parseConnectionString("postgresql://postgres.abc:geheim@aws-0-eu-west-1.pooler.supabase.com:6543/postgres");
    expect(c).toEqual({
      host: "aws-0-eu-west-1.pooler.supabase.com",
      port: 6543,
      database: "postgres",
      username: "postgres.abc",
      password: "geheim",
      ssl: true,
    });
  });

  it("akzeptiert unkodierte Sonderzeichen im Passwort", () => {
    const c = parseConnectionString("postgresql://postgres.abc:p@ss#w/rd?%x@db.example.ch:6543/postgres");
    expect(c.password).toBe("p@ss#w/rd?%x");
    expect(c.host).toBe("db.example.ch");
  });

  it("dekodiert kodierte Passwörter und entfernt Anführungszeichen, Leerzeichen und Platzhalter-Klammern", () => {
    expect(parseConnectionString(' "postgres://u:a%40b@h:5432/db" ').password).toBe("a@b");
    expect(parseConnectionString("postgresql://u:[meinPasswort]@h.pooler.supabase.com:6543/postgres").password).toBe("meinPasswort");
  });

  it("löst die Adresse aus kopierten Varianten heraus", () => {
    const url = "postgresql://postgres.abc:pw@aws-0-eu-west-1.pooler.supabase.com:6543/postgres";
    expect(parseConnectionString(`DATABASE_URL="${url}"`).host).toBe("aws-0-eu-west-1.pooler.supabase.com");
    expect(parseConnectionString(`psql ${url}`).password).toBe("pw");
    expect(parseConnectionString(`\n  ${url}\n`).port).toBe(6543);
    expect(() => parseConnectionString("host=db user=postgres")).toThrow(/beginnt mit «host=db user…»/);
  });

  it("lokale Verbindung ohne TLS, sslmode wird respektiert", () => {
    expect(parseConnectionString("postgres://postgres:pw@localhost:54322/postgres").ssl).toBe(false);
    expect(parseConnectionString("postgres://u:pw@h.pooler.supabase.com:6543/postgres?sslmode=disable").ssl).toBe(false);
  });

  it("meldet Fehler verständlich und ohne Passwort", () => {
    expect(() => parseConnectionString("postgresql://u:[YOUR-PASSWORD]@h:6543/postgres")).toThrow(/Platzhalter/);
    expect(() => parseConnectionString("mysql://u:geheim@h/db")).toThrow(ConnectionStringError);
    try {
      parseConnectionString("http://u:geheim@h/db");
    } catch (e) {
      expect(String(e)).not.toContain("geheim");
    }
  });
});
