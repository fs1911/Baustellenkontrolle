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
