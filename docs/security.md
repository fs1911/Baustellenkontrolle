# Sicherheit und Datenschutz

## Authentifizierung

| Modus | Einsatz | Details |
|---|---|---|
| `AUTH_PROVIDER=supabase` | Test/Produktion (erzwungen in `APP_ENV=production`) | Supabase Auth; MFA (TOTP) aktivierbar; Microsoft Entra ID via Azure-Provider (`AUTH_ENABLE_AZURE=true`); Sitzung in httpOnly-Cookies (`@supabase/ssr`) |
| `AUTH_PROVIDER=local` | Entwicklung/CI | Passwortprüfung gegen `auth.users` (bcrypt), eigene JWT-Sitzung (HS256, 10 h, httpOnly, SameSite=Lax, Secure bei HTTPS) |

Anmeldeversuche sind begrenzt (8 je 10 Minuten je E-Mail/IP und Instanz; in Produktion zusätzlich
Supabase-Rate-Limits). Deaktivierte Profile verlieren sofort jeden Zugriff (alle Berechtigungsfunktionen
prüfen `is_active`).

## Autorisierung (serverseitig, Row Level Security)

Jede Anfrage läuft als `role authenticated` mit den Claims des Benutzers. Hilfsfunktionen im Schema `app`
(security definer, fester `search_path`) berechnen die Zugriffsmengen:

| Menge | Wer | Rechte |
|---|---|---|
| verwaltbare Gesellschaften | admin, group_ims (gruppenweit oder je Gesellschaft) | alles in diesen Gesellschaften |
| Edit-Baustellen | obige + Mitgliedschaft Projektleitung | Kontrollen, Feststellungen, Berichte, Versand, Verifikation |
| Work-Baustellen | Edit + Mitgliedschaft Polier | lesen; Massnahmen umsetzen (bis «Behoben»), Kommentare, Nachweise |
| Viewer-Baustellen | viewer (Gesellschaft/gruppenweit) + Mitgliedschaft lesend | abgeschlossene Kontrollen, freigegebene/versendete Berichte, Dashboards; keine Änderungen |

Zusätzlich: Rollenvergabe nur durch Admin (keine Rechteausweitung), Audit Log nur für Admin lesbar und für
niemanden änderbar, Katalogpflege nur Admin/IMS, Polier-Einschränkungen per Trigger (keine Änderung von
Frist/Definition, keine Verifikation). Getestet in `tests/integration/rls.test.ts` (26 Fälle).

## Dateien (Fotos, Logos, Berichte)

- Buckets `company-logos`, `finding-images`, `generated-reports`, `attachments` – alle **privat**.
- Pfadschema `<company_id>/<site_id>/…`; Storage-Policies prüfen den Baustellenzugriff zusätzlich.
- Auslieferung ausschliesslich über **signierte, kurzlebige URLs** (Standard 300 s), die erst nach einer
  RLS-geprüften DB-Abfrage ausgestellt werden (lokal: HMAC-JWT, Supabase: `createSignedUrl`).
- Uploads: Grössenlimit (15 MB, Logos 5 MB), Formatprüfung anhand des Inhalts (sharp), Pixel-Limit,
  **Neukodierung** als JPEG/PNG (neutralisiert eingebettete Fremdinhalte), SVG wird gerastert (nie als SVG ausgeliefert),
  EXIF/GPS standardmässig entfernt (konfigurierbar). Pfade gegen Traversal geprüft.
- Malware-Prüfung: Die Neukodierung ist die erste Verteidigungslinie. Für zusätzliche Scans (z. B. ClamAV,
  Cloud-Scanner) ist der Upload-Pfad in `src/lib/services/findings.ts` bzw. `api/actions/[id]/evidence` der
  Integrationspunkt (vor `storage().put`).

## Web-Sicherheit

- Sicherheits-Header (`next.config.ts`): CSP (`default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`),
  HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` (Kamera/Mikrofon nur self).
  Härtung: CSP mit Nonce statt `'unsafe-inline'` für Skripte (Next-Proxy) als nächster Schritt.
- CSRF: Server Actions prüfen Origin (Next.js); eigene POST-Route-Handler prüfen `Origin` (`assertSameOrigin`); Cookies `SameSite=Lax`.
- XSS: React-Escaping; E-Mail-HTML escaped Benutzertext; keine `dangerouslySetInnerHTML`.
- Injection: ausschliesslich parametrisierte Abfragen (`postgres.js` Tagged Templates).
- Validierung: Zod-Schemas serverseitig für alle Aktionen (`src/lib/domain/validation.ts`), DB-Constraints als zweite Stufe.
- Fehlermeldungen: verständlich, ohne interne Details (`src/lib/utils/errors.ts`).

## Audit Trail

Trigger protokollieren Erstellung, Änderung (nur geänderte Felder) und Löschung/Soft Delete auf allen
wesentlichen Tabellen; `app.log_event` protokolliert Anmeldung, Freigabe, Versand, Versandfehler, Download,
Export, Neuberechnung und Löschläufe. Der Akteur stammt immer aus der Sitzung.

## Datenschutz (DSG)

- Datenminimierung: nur geschäftliche Kontaktdaten; Verantwortlichkeiten primär als **Rolle**, Person optional.
- Keine personenbezogenen Rankings; Auswertungen beziehen sich auf Baustellen, Gesellschaften, Kategorien.
- Bildhinweise und Datenschutzerklärung unter `/datenschutz` (Vorlage, durch Verantwortliche zu finalisieren).
- Auskunft: Benutzer können ihre Daten unter «Profil» als JSON exportieren.
- KI: externe Verarbeitung **standardmässig aus**; Freigabe durch Admin getrennt für Texte und Fotos; Nutzung ist
  protokolliert (`ai_suggestions`). Siehe `ai-integration.md`.
- Aufbewahrung (Einstellungen → Aufbewahrung): Kontrollen 10 J., Fotos 5 J., Versandprotokolle 10 J., Audit 10 J.,
  KI-Vorschläge 365 T., soft-gelöschte Fotos 30 T. Trockenlauf + protokollierte Ausführung (`src/lib/services/retention.ts`),
  empfohlen monatlich per Cron.
- Offline: Kontrollseiten werden im Browser-Cache abgelegt, beim Abmelden gelöscht; die Offline-Warteschlange
  (IndexedDB) enthält nur noch nicht synchronisierte Erfassungen.

## Umgebungstrennung

`APP_ENV` = development | test | staging | production. Produktion verweigert Start mit lokaler Auth,
lokalem Storage oder Sandbox-Mailer. Getrennte Supabase-Projekte (bzw. Branches) je Umgebung; Seed ist in
Produktion gesperrt. Secrets nur als Umgebungsvariablen (siehe `.env.example`).

## Bekannte Grenzen / nächste Schritte

- CSP-Nonce, Rate-Limiting verteilt (z. B. Upstash/Redis) statt In-Memory.
- Virenscanner-Anbindung (siehe oben).
- Penetrationstest vor Produktivsetzung; Auftragsbearbeitungsvertrag mit Hosting-/KI-Anbietern (Region EU/CH).
