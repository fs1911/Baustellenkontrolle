# Baustellenkontrolle – tozzo gruppe ag

Mobile-first Web-App (PWA) zur Durchführung und Auswertung von Baustellenkontrollen in der Schweiz:
Kontrollen erfassen, Feststellungen mit Fotos dokumentieren, Abweichungen bewerten, Massnahmen verfolgen,
professionelle PDF-Berichte im Corporate Design der Gesellschaft erzeugen und nach Freigabe per E-Mail
versenden. Wiederkehrende Abweichungen werden mit einem transparenten Punktemodell erkannt.

> Referenzen zu BauAV, VUV, EKAS, Suva, ISO usw. sind **Orientierungshilfen** und im Initialkatalog
> bewusst als **«zu prüfen»** markiert (keine erfundenen Artikelnummern oder Links). Berichte enthalten
> stets den Hinweis, dass es sich um betriebliche Kontrollfeststellungen handelt und eine fachliche bzw.
> rechtliche Würdigung im Einzelfall vorbehalten bleibt.

## Schnellstart (Entwicklung)

Voraussetzungen: Node.js ≥ 22, Docker.

```bash
npm ci
cp .env.example .env.local          # SESSION_SECRET setzen (≥ 32 Zeichen)
npm run db:reset                    # Supabase-Postgres (Docker) + Migrationen + Demo-Daten
npm run dev                         # http://localhost:3000
```

Demo-Zugänge (Passwort `Baustelle!2026`, nur Entwicklung):

| E-Mail | Rolle |
|---|---|
| admin@tozzo-gruppe.example | Administrator |
| sibe@tozzo-gruppe.example | Gruppen-IMS / SIBE |
| s.meier@hochbau.example | Projektleiterin (Birr, Zürich Nord) |
| l.rossi@tiefbau.example | Bauleiter Tiefbau (Beispielstrasse) |
| n.frei@tozzo-gruppe.example | Projektleiterin (Sanierung Aargau) |
| b.huber@hochbau.example | Polier (Birr) |
| gl@tozzo-gruppe.example | Management (lesend) |

Ohne produktive Zugangsdaten läuft alles lokal: Anmeldung gegen `auth.users`, Dateien im Dateisystem
(signierte, kurzlebige Links), E-Mails in der **Mail-Sandbox** (Verwaltung → Mail-Sandbox), KI regelbasiert.

## Skripte

| Befehl | Zweck |
|---|---|
| `npm run dev` / `build` / `start` | Next.js Entwicklung / Produktions-Build / Start |
| `npm run db:up` / `db:down` / `db:reset` | Lokale Datenbank (supabase/postgres) |
| `npm run db:migrate` | SQL-Migrationen aus `supabase/migrations` anwenden |
| `npm run db:seed` | Demo-Daten (setzt Fachdaten zurück; in Produktion gesperrt) |
| `npm run lint` / `typecheck` / `format:check` | Qualitätsprüfungen |
| `npm test` | Unit-Tests (Domänenlogik: Scoring, Klassifikator, Summary, E-Mail) |
| `npm run test:integration` | RLS-, Berechtigungs-, Berichts- und Versandtests gegen echte DB |
| `npm run test:e2e` | Playwright: Kernprozess, Berechtigungen, Offline, Barrierefreiheit, Responsive |

Aktueller Stand: 31 Unit-, 32 Integrations- und 34 E2E-Tests grün; Lint, Typecheck, Format, Build ohne Warnungen.

## Projektstruktur

```
supabase/migrations/     Schema, Enums, Constraints, Trigger, RLS, Audit, Storage-Policies
supabase/functions/      Edge Function (Cron-Auslöser)
scripts/                 Migrator, Seed
src/app/                 Seiten (App Router), Server Actions, Route Handlers (API)
src/components/          UI-Komponenten (Design-System), Formulare, Diagramme, Admin
src/lib/domain/          Reine Domänenlogik (Enums, Validierung, Scoring, Klassifikator, Summary)
src/lib/repositories/    Datenzugriff (SQL unter RLS)
src/lib/services/        Integrationen: Storage, Bilder, Mail, KI, PDF, Berichte, Jobs, Aufbewahrung
tests/                   unit/, integration/, e2e/
docs/                    Architektur, Datenmodell, Sicherheit, Betrieb, Governance, Demo-Checkliste
```

## Dokumentation

- [Architektur und Entscheidungen](docs/architecture.md)
- [Datenmodell](docs/data-model.md)
- [Sicherheit und Datenschutz](docs/security.md)
- [Annahmen](docs/assumptions.md)
- [Deployment und Betrieb](docs/deployment.md)
- [E-Mail-Integration](docs/email-integration.md)
- [KI-Integration](docs/ai-integration.md)
- [Governance Referenzkatalog](docs/reference-catalog-governance.md)
- [Demo-Checkliste / fachliche Abnahme](docs/demo-checklist.md)
- Design-System: in der App unter `/design-system`
