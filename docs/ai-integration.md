# KI-Integration

Grundsatz: KI **unterstützt**, entscheidet nie. Alle Ergebnisse sind als «Vorschlag» gekennzeichnet, mit
Begründung sichtbar und müssen übernommen, angepasst oder verworfen werden. Jede Anfrage und Entscheidung
wird in `ai_suggestions` protokolliert (Provider, Modell, Input-Hash, Vorschlag, Status, Person, Zeitpunkt).

## Funktionen

| Funktion | Ort | Regel-Fallback | Externer Dienst |
|---|---|---|---|
| Kategorie/Unterkategorie, Beurteilung, Risiko, Massnahmen, Referenzen | Feststellungsformular «Vorschlag erstellen» | `src/lib/domain/classifier.ts` (Schlagworte aus dem Katalog, Signalwörter, Höhenangaben, Eskalation) | Anthropic, strukturierte Ausgabe (Zod), Katalogcodes erzwungen |
| Hinweise auf fehlende Angaben | Feststellungsformular | `completenessHints` | – (immer lokal) |
| Ähnliche frühere Feststellungen | Feststellungsformular | pg_trgm-Ähnlichkeit + Kategoriebonus (RLS-gefiltert) | – |
| Wiederholungs-Score, Cluster, Hinweise | Formular, Dashboard, «Wiederkehrende Abweichungen» | `src/lib/domain/recurrence.ts` | – (transparent, deterministisch) |
| Management Summary | Berichtsseite «Summary vorschlagen» | `src/lib/domain/summary.ts` (nur gespeicherte Fakten) | Anthropic, System-Prompt: keine erfundenen Fakten, keine Rechtsbewertung, keine Vorwürfe, Schweizer Hochdeutsch |

## Aktivierung eines externen Providers

1. `AI_PROVIDER=anthropic`, `ANTHROPIC_API_KEY=…`, optional `AI_MODEL` (Standard `claude-opus-5`).
2. Verwaltung → Einstellungen → KI: «Externe KI-Dienste zulassen» aktivieren (separat: «Fotos übermitteln»).
3. Ohne beide Bedingungen bleibt die App im Regelmodus. Fehler, Zeitüberschreitungen oder unplausible
   Antworten (z. B. unbekannter Kategoriecode) führen automatisch zum Regel-Fallback – die App schlägt nie fehl.

Implementierung: `src/lib/services/ai/index.ts` – offizielles SDK `@anthropic-ai/sdk`, `messages.parse` mit
`zodOutputFormat`, `effort: "low"` für kurze Latenz, Timeout 30 s, 1 Retry, Refusal-Behandlung.
Weitere Provider werden als zusätzliche Implementierung derselben Funktionen (`suggestClassification`,
`suggestSummary`) ergänzt; die Aufrufer bleiben unverändert.

## Datenschutz

- Übermittelt werden nur Titel/Beschreibung der Feststellung bzw. aggregierte Berichtsdaten (Zählwerte,
  Titel, Kategorien) – keine Namen von Personen in der Summary-Anfrage.
- Fotos nur bei expliziter Freigabe (max. 2 Bilder je Anfrage).
- Vor Aktivierung: Auftragsbearbeitung/Datenschutzabklärung mit dem Anbieter (Datenstandort, Aufbewahrung).

## Erweiterung pgvector

Die Extension ist im Supabase-Image verfügbar. Mit einem Embedding-Dienst kann `findings` um eine
`embedding vector(n)`-Spalte ergänzt und `findSimilar` um Kosinus-Ähnlichkeit erweitert werden; das
Trigramm-Verfahren bleibt als erklärbarer Fallback.
