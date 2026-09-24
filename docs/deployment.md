# Deployment und Betrieb

## Umgebungen

| Umgebung | Datenbank | Auth | Storage | Mail | KI |
|---|---|---|---|---|---|
| development | Docker `supabase/postgres` | local | local | sandbox | rules |
| test/CI | Service-Container `supabase/postgres` | local | local | sandbox | rules |
| staging | eigenes Supabase-Projekt | supabase | supabase | smtp/graph (Testpostfach) | rules/anthropic |
| production | eigenes Supabase-Projekt (Region EU/CH) | supabase (+MFA, Entra ID) | supabase | graph/smtp | nach Freigabe |

`APP_ENV=production` verweigert den Start mit local/sandbox-Providern.

## Supabase einrichten

1. Projekt anlegen (Region z. B. `eu-central-2` Zürich, sofern verfügbar, sonst EU), separates Projekt je Umgebung.
2. Migrationen anwenden – eine der Varianten:
   - Supabase CLI: `supabase link --project-ref <ref>` und `supabase db push`
   - oder `DATABASE_ADMIN_URL=<direkte Verbindung, Port 5432> npm run db:migrate`
3. Storage: Buckets werden von Migration 005 privat angelegt (Grössen- und MIME-Limits).
4. Auth:
   - E-Mail/Passwort, Registrierung deaktivieren (`enable_signup = false`), Einladungen durch Admin.
   - MFA (TOTP) aktivieren.
   - Microsoft Entra ID: App-Registrierung (Redirect `https://<projekt>.supabase.co/auth/v1/callback`),
     Azure-Provider in Supabase konfigurieren, `AUTH_ENABLE_AZURE=true`.
   - Site URL / Redirect: `https://<app>/auth/callback`.
5. Erster Admin: Benutzer in Supabase Auth einladen, danach per SQL
   `insert into user_profiles (id, full_name, business_email) …; insert into user_roles (user_id, role) values (…, 'admin');`
6. Stammdaten (Gesellschaften, Logos) und Katalog: Seed **nicht** in Produktion verwenden; Katalog über
   `npm run db:seed` in Staging erzeugen und exportieren oder über die Verwaltung pflegen
   (Initialkatalog: `src/lib/domain/catalog-data.ts`).

## App deployen

Beliebige Node-Plattform mit Next.js 16 (Node ≥ 20.9). Build `npm run build`, Start `npm run start`.

Pflicht-Umgebungsvariablen (Produktion): `APP_ENV`, `APP_BASE_URL`, `DATABASE_URL` (Supabase Transaction
Pooler, Port 6543; `prepare: false` ist gesetzt), `SESSION_SECRET`, `AUTH_PROVIDER=supabase`,
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`STORAGE_PROVIDER=supabase`, `MAIL_PROVIDER` + zugehörige Werte, `CRON_SECRET`. Vollständige Liste: `.env.example`.

Die DB-Verbindung läuft als Rolle `postgres` und wechselt pro Anfrage auf `authenticated` (RLS). Der
Service-Role-Key wird nur serverseitig für Storage und Auth-Admin genutzt.

## Cloudflare Workers (vinext)

Neben dem Node-Build (`next build`) lässt sich die App mit [vinext](https://vinext.dev) (Beta) als
Cloudflare Worker betreiben. Der Node-Build bleibt unverändert; der Workers-Build nutzt `vite.config.ts`
und `wrangler.jsonc`.

### Unterschiede zum Node-Betrieb

| Thema | Workers | Umsetzung |
|---|---|---|
| Bildverarbeitung | kein `sharp` (nativ) | `IMAGE_PROCESSING=basic`: Fotos werden im Browser verkleinert und als JPEG neu kodiert; der Server prüft Signatur/Abmessungen und entfernt EXIF/GPS byteweise (`src/lib/services/image-basic.ts`). Logos nur PNG/JPEG (kein SVG). |
| Datenbank | keine Verbindungen über Anfragen hinweg | pro Transaktion eigene Verbindung (`src/lib/db/client.ts`), `DATABASE_URL` = Supabase Transaction Pooler |
| Dateien | kein beschreibbares Dateisystem | `STORAGE_PROVIDER=supabase`; Mail-Sandbox in `attachments/mail-sandbox/` |
| PDF | `@react-pdf` | Build-Anpassungen in `vite.config.ts` (Browser-Build von pdfkit, vorkompiliertes Yoga-WebAssembly, volles React für den PDF-Renderer) |

### CPU-Zeit und Plan

Gemessen (Node, gleiche V8-Engine): PDF-Bericht mit 5 Feststellungen/5 Fotos ≈ 270–580 ms CPU,
Fotoprüfung ≈ 0,2 ms. **Workers Free erlaubt 10 ms CPU pro Anfrage.** Auf dem Gratisplan funktionieren
daher PDF-Vorschau, «Freigeben und senden» sowie PDF-/Excel-Export nicht zuverlässig (Abbruch mit Fehler
1102). Für den produktiven Einsatz: **Workers Paid** (ab 5 USD/Monat, bis 5 Min. CPU) – keine Codeänderung
nötig, optional `"limits": { "cpu_ms": 30000 }` in `wrangler.jsonc`.

### Ersteinrichtung

```bash
npx wrangler login
# Secrets (werden verschlüsselt bei Cloudflare gespeichert, nie im Repository):
npx wrangler secret put DATABASE_URL            # Supabase → Connect → Transaction pooler (Port 6543)
npx wrangler secret put SESSION_SECRET          # openssl rand -base64 48
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npm run deploy:workers                          # baut und deployt
```

Danach in `wrangler.jsonc` `APP_BASE_URL` auf die angezeigte Adresse
(`https://baustellenkontrolle.<konto>.workers.dev`) setzen und erneut deployen – die Adresse steuert
sichere Cookies und die Herkunftsprüfung.

Demodaten (nur Staging, einmalig, von einem Rechner mit Node):
`APP_ENV=staging STORAGE_PROVIDER=supabase NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… DATABASE_URL=… DEMO_PASSWORD=… npm run db:seed`.

**Wichtig:** Eine workers.dev-Adresse ist öffentlich erreichbar. Das Standard-Demopasswort steht im README –
für jede erreichbare Umgebung ein eigenes `DEMO_PASSWORD` setzen (sonst kann sich jede Person als Admin
anmelden) und die Adresse zusätzlich mit Cloudflare Access schützen, sobald echte Daten erfasst werden.

Lokal testen: `npm run build:workers` und `npm run preview:workers` (workerd). Achtung: der Build kopiert
`.env.local` nach `dist/server/.dev.vars` (nur lokal, wird nicht deployt).

Alternativ Deployment über **Workers Builds** (GitHub-Anbindung im Cloudflare-Dashboard):

| Feld | Wert |
|---|---|
| Build-Befehl | `npm run build:workers` (nicht `npm run build` – das ist der Node-Build) |
| Deploy-Befehl | `npx vinext-cloudflare deploy --skip-build` |
| Secrets | Worker → Settings → Variables and Secrets: `DATABASE_URL`, `SESSION_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` (Typ «Secret») |

Der Build benötigt keine Secrets; sie werden erst zur Laufzeit gelesen.

## Zeitgesteuerte Jobs

| Job | Endpunkt | Empfehlung |
|---|---|---|
| Wiederkehrende Abweichungen | `POST /api/jobs/recurrence` (Header `Authorization: Bearer $CRON_SECRET`) | täglich; zusätzlich automatisch nach Abschluss einer Kontrolle |
| Aufbewahrung | Verwaltung → Einstellungen (Trockenlauf/Ausführung) | monatlich prüfen |

Auslöser z. B. Vercel Cron, Supabase Edge Function `supabase/functions/recurrence-cron` mit pg_cron, oder GitHub Actions.

## Betrieb

- Backups: Supabase Point-in-Time-Recovery aktivieren; Storage-Buckets in Backup-Konzept aufnehmen.
- Monitoring: Server-Logs (Fehler werden ohne Personendaten geloggt), Supabase-Advisors (Security/Performance).
- Updates: `npm audit`, Next.js-Minor-Updates; Migrationen nur vorwärts, nie bestehende Dateien ändern.
- Wiederherstellung Versand: fehlgeschlagene E-Mails im Bericht bzw. Berichtshistorie erneut senden.
