# Architektur

## Bestandsaufnahme zu Projektbeginn

| Bereich | Befund | Konsequenz |
|---|---|---|
| Repository | leer (`fs1911/baustellenkontrolle`) | Neuaufbau nach vorgegebener Zielarchitektur |
| Supabase | Zugang vorhanden, aber nur zwei fremde Projekte («shiftproof», «StoffScan») | **Kein** Eingriff in fremde Projekte; kein neues (kostenpflichtiges) Projekt ohne Freigabe. Entwicklung gegen das offizielle `supabase/postgres`-Image lokal; Migrationen sind 1:1 auf Supabase anwendbar |
| E-Mail / Microsoft 365 | keine Integration verfügbar | Abstrahierte Mail-Schicht mit Sandbox, SMTP und Microsoft Graph |
| KI-Provider | kein API-Key | Provider-Adapter mit regelbasiertem Fallback; Anthropic über offizielles SDK vorbereitet |
| Deployment | Netlify/Railway/Cloudflare-Connectoren vorhanden, aber ohne Projektvorgabe | Nicht automatisch deployt (Kosten/Zugang = Entscheid des Betreibers); siehe `deployment.md` |

## Architekturentscheid

**Next.js 16 (App Router, TypeScript) + PostgreSQL mit Supabase-kompatiblem Schema und Row Level Security.**

- **Datenbankzentrierte Autorisierung.** Jede Benutzeranfrage läuft in einer Transaktion mit
  `set local role authenticated` und den JWT-Claims des Benutzers – exakt wie Supabase/PostgREST.
  Dadurch greifen dieselben RLS-Policies, egal ob die App gegen Supabase oder lokal läuft.
  UI-Ausblendung ist nur Komfort; die Durchsetzung erfolgt in der DB (siehe `security.md`).
- **Server-seitiger Datenzugriff** (Server Components, Server Actions, Route Handlers) mit `postgres.js`
  statt Browser-Zugriff auf PostgREST: weniger Angriffsfläche, keine Service-Keys im Client, Transaktionen
  über mehrere Tabellen (z. B. Freigabe + Version + Versandprotokoll).
- **Adapter statt harter Abhängigkeiten**: Auth (`local`/`supabase`), Storage (`local`/`supabase`),
  Mail (`sandbox`/`smtp`/`graph`), KI (`rules`/`anthropic`). Produktion erzwingt echte Provider (`env.ts`).
- **PDF serverseitig mit `@react-pdf/renderer`** (reines Node, kein Headless-Browser nötig → robust auf
  Serverless/Container). HTML-Vorschau und PDF entstehen aus demselben unveränderlichen Berichts-Snapshot.
- **PWA**: Service Worker (Network-first für Seiten, Cache-first für Assets, nie API/Dateien),
  Offline-Warteschlange in IndexedDB mit idempotenter Synchronisation (`client_ref`).

Verworfene Alternativen: Browser-Client direkt gegen PostgREST (mehr Logik im Client, Transaktionen
schwierig); Puppeteer für PDF (schwergewichtig, fragil in Serverless); Vektor-Embeddings ohne Provider
(pgvector ist verfügbar, aber ohne Embedding-Dienst nicht sinnvoll – Trigramm-Ähnlichkeit ist erklärbar
und läuft lokal).

## Komponenten

```
Browser (PWA) ──► Next.js (Proxy: Sitzungs-Vorprüfung, Sicherheits-Header)
                   ├─ Server Components / Server Actions ─► lib/repositories ─► PostgreSQL (RLS)
                   ├─ Route Handlers (/api/*): Upload, Sync, KI, PDF, Export, Dateien, Cron
                   └─ lib/services: storage · images (sharp) · mail · ai · pdf · reports · retention · recurrence-job
PostgreSQL: Schema public (Fachdaten) + app (Berechtigungs-/Integritätsfunktionen) + auth/storage (Supabase)
```

### Schichten

| Schicht | Verzeichnis | Regeln |
|---|---|---|
| Domäne | `src/lib/domain` | rein, testbar, ohne I/O (Scoring, Klassifikator, Validierung, Summary, E-Mail-Regeln) |
| Datenzugriff | `src/lib/repositories` | SQL; Aufruf nur innerhalb `withUser` (RLS) bzw. begründet `withService` |
| Integrationen | `src/lib/services` | Adapter mit Fallback; keine Secrets im Code |
| UI | `src/app`, `src/components` | Server Components für Daten, Client Components nur für Interaktion |

## Kern-User-Flows

1. **Kontrolle**: Gesellschaft (Pflicht) → Baustelle wählen/anlegen → Metadaten, Anwesende → Kontrolle.
2. **Feststellung**: Beurteilung → Titel/Beschreibung (Diktat) → optional «Vorschlag erstellen» (Kategorie,
   Risiko, Massnahme, Referenzen inkl. Begründung) → Übernehmen/Anpassen/Verwerfen (protokolliert) →
   Fotos (Kamera/Galerie, Vorschau, Legende) → Massnahme, Verantwortung, Frist → Speichern.
   Seitenleiste: Vollständigkeitshinweise, Wiederholungs-Score mit Kriterien, ähnliche Feststellungen.
3. **Schnellerfassung**: grosse Kacheln, Kamera direkt, häufige Feststellungen aus Vorlage, offline fähig.
4. **Bericht**: Vorschau → Summary (Vorschlag) bearbeiten → Entwurf (Version) → Empfänger/Betreff/Text →
   Bestätigung → finale Version (PDF, SHA-256) → Versand → Protokoll (Retry bei Fehler).
5. **Massnahmen**: Status, Kommentar, Nachweisfoto; Verifikation nur Projektleitung/SIBE.
6. **Analyse**: Dashboard, wiederkehrende Abweichungen, Management-Ansicht mit PDF/Excel-Export.

## Wiederkehrende Abweichungen

`src/lib/domain/recurrence.ts` – Punktemodell (konfigurierbar unter Einstellungen), Standard:
+3 gleiche Unterkategorie (90 Tage), +2 ähnliche Beschreibung (Trigramm ≥ 35 %), +2 gleiche Baustelle,
+2 gleiche Verantwortungsrolle, +3 hohe/kritische Risikostufe, +2 überfällige Massnahme, +1 je weitere
ähnliche Feststellung (max. 10), +1 gleicher Bereich/Gewerk. Cluster auf Ebene Baustelle, Gesellschaft
(≥ 2 Baustellen) und Gruppe (≥ 2 Gesellschaften) werden als Snapshot gespeichert (Job nach Abschluss einer
Kontrolle, manuell oder per Cron). Jede Punktvergabe ist mit Kriterium und Begründung gespeichert und
wird angezeigt. Formulierungen beziehen sich auf Rollen, nie auf Personen.

## Diagramme und Design-System

- Farbtokens, Typografie, Komponenten: `src/app/globals.css`, `src/components/ui`, Übersicht unter `/design-system`.
- Diagramme (Recharts): Beurteilungen in Statusfarben (Rot/Amber/Grün, validiert auf Farbfehlsichtigkeit;
  Grenzbereich durch Legende, 2-px-Segmentabstände, Tooltip und Tabellenansicht abgesichert), Magnitude
  einfarbig blau, eine Achse, Heatmap sequenziell mit Zahlen. Jede Grafik verlinkt auf die Feststellungen.
- Bewusst **nur heller Modus**: auf der Baustelle (Sonnenlicht) ist hoher Kontrast auf hellem Grund
  besser lesbar; Dark Mode ist als Erweiterung möglich (Tokens sind zentral definiert).
