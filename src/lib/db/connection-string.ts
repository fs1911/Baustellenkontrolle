/**
 * Zerlegt eine Postgres-Verbindungszeichenfolge tolerant in ihre Bestandteile.
 *
 * Supabase-Passwörter enthalten oft Sonderzeichen (#, @, /, ?, %), die in einer URL kodiert sein
 * müssten. Wird die Zeichenfolge unkodiert kopiert, scheitert `new URL()`. Hier gilt deshalb:
 * Benutzer bis zum ersten «:», Passwort bis zum letzten «@» vor dem Host.
 * Fehlermeldungen enthalten nie das Passwort.
 */
export interface ConnectionParts {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
}

export class ConnectionStringError extends Error {}

export function parseConnectionString(input: string): ConnectionParts {
  let s = input.trim();
  // Häufige Kopierfehler: umschliessende Anführungszeichen
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1).trim();

  const scheme = s.match(/^(postgres|postgresql):\/\//i);
  if (!scheme) throw new ConnectionStringError("DATABASE_URL muss mit postgresql:// beginnen.");
  const rest = s.slice(scheme[0].length);

  const at = rest.lastIndexOf("@");
  if (at < 0) throw new ConnectionStringError("DATABASE_URL enthält keinen Benutzer/Passwort-Teil (…:passwort@host).");
  const credentials = rest.slice(0, at);
  const location = rest.slice(at + 1);

  const colon = credentials.indexOf(":");
  if (colon < 0) throw new ConnectionStringError("DATABASE_URL enthält kein Passwort (benutzer:passwort@host).");
  const username = decodeLenient(credentials.slice(0, colon));
  let password = decodeLenient(credentials.slice(colon + 1));
  // Platzhalter-Klammern aus «[YOUR-PASSWORD]» wurden mitkopiert
  if (password.startsWith("[") && password.endsWith("]")) password = password.slice(1, -1);
  if (!password || password === "YOUR-PASSWORD") {
    throw new ConnectionStringError("In DATABASE_URL steht noch der Platzhalter statt des Datenbank-Passworts.");
  }

  const hostMatch = location.match(/^([^:/?#]+)(?::(\d+))?(?:\/([^?#]*))?(?:\?(.*))?$/);
  if (!hostMatch) throw new ConnectionStringError("Host/Port/Datenbank in DATABASE_URL sind nicht lesbar.");
  const [, host, port, database, query] = hostMatch;
  const params = new URLSearchParams(query ?? "");
  const sslmode = params.get("sslmode");
  const ssl = sslmode ? sslmode !== "disable" : /\.supabase\.(com|co)$/i.test(host);

  return {
    host,
    port: port ? Number(port) : 5432,
    database: decodeLenient(database || "postgres"),
    username,
    password,
    ssl,
  };
}

function decodeLenient(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value; // unkodiertes «%» im Passwort
  }
}
