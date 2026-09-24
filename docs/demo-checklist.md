# Demo-Checkliste / fachliche Abnahme

Vorbereitung: `npm run db:reset && npm run dev` (oder `npm run build && npm run start`), Passwort `Baustelle!2026`.
Für Mobiltests: Browser-Gerätemodus oder Smartphone im selben Netz (`http://<rechner-ip>:3000`; Kamera
benötigt HTTPS ausser auf `localhost` – Galerie-Upload funktioniert immer).

| # | Abnahmekriterium | Vorgehen (Demo) | Automatischer Nachweis |
|---|---|---|---|
| 1 | Anmeldung berechtigter Benutzer | `/login` mit `sibe@tozzo-gruppe.example` | e2e: alle Specs; RLS-Tests |
| 2 | Gesellschaft wählen | «Neue Kontrolle» → Kachel «Beispielgesellschaft Hochbau AG» (Pflicht) | e2e core-flow |
| 3 | Baustelle wählen/anlegen | Baustelle «Wohnüberbauung Birr» oder «Neue Baustelle» (Dialog) | e2e core-flow; RLS `sites_insert` |
| 4 | Neue Kontrolle | «Kontrolle starten» | e2e core-flow |
| 5 | Mehrere Feststellungen mit Text, Bewertung, Risiko, Kategorie, Massnahme, Bildern | «Feststellung» → Formular; «Speichern & nächste» | e2e core-flow |
| 6 | Foto aufnehmen/hochladen | «Foto aufnehmen» (Kamera) / «Aus Galerie»; Vorschau + Legende | e2e core-flow, offline |
| 7 | Positiv/negativ/Verbesserung eindeutig | Badges mit Icon + Text, Farbbalken | Design-System `/design-system`; a11y-Tests |
| 8 | Referenzvorschläge | Kategorie wählen → Abschnitt «Referenzen / Orientierungshilfen» (mit «zu prüfen») | e2e core-flow (Vorschlag) |
| 9 | Ähnliche frühere Feststellungen | Titel «Seitenschutz fehlt» eingeben → Seitenleiste mit Kriterien | – (manuell), Repository `findSimilar` |
| 10 | Wiederkehrende Abweichungen nachvollziehbar | `/wiederkehrend`: Score, Kriterientabelle, zugehörige Feststellungen; Formular zeigt Wiederholungshinweis | unit `recurrence.test.ts` |
| 11 | Dashboard mit Kennzahlen, Trends, überfälligen Massnahmen, Wiederholungen | `/dashboard`, Filter, Diagramme anklicken → Drilldown | e2e a11y/responsive |
| 12 | PDF-Bericht | Kontrolle → «Bericht» → «PDF-Vorschau» | integration `report.test.ts`, e2e core-flow |
| 13 | Logo der gewählten Gesellschaft | Vorschau und PDF zeigen Logo/Farbe der Gesellschaft; Logo ändern unter Verwaltung → Gesellschaften | integration + e2e |
| 14 | Fotos, Feststellungen, Massnahmen, Summary, Disclaimer im Bericht | PDF prüfen (Deckblatt, Summary, Feststellungen, Massnahmentabelle, Positive, Schluss) | integration `report.test.ts` |
| 15 | Prüfen und bearbeiten vor Versand | Summary vorschlagen/bearbeiten, «Entwurf speichern», Betreff/Text anpassen | e2e core-flow |
| 16 | Versand nach expliziter Freigabe an eigene Adresse | «Bericht freigeben und senden» → Bestätigung → Mail-Sandbox | integration + e2e |
| 17 | Versand und Versionen protokolliert | Abschnitte «Berichtsversionen», «Versandprotokoll»; Verwaltung → Audit-Log (release/send) | integration `report.test.ts` |
| 18 | Keine fremden Daten | als `b.huber@hochbau.example` (nur Birr) bzw. `l.rossi@tiefbau.example` anmelden; fremde URL → «Nicht gefunden oder keine Berechtigung» | integration `rls.test.ts` (26), e2e permissions |
| 19 | Smartphone, Tablet, Desktop | Gerätemodus 375/820/1440 px | e2e responsive (kein horizontales Scrollen, Touch-Ziele ≥ 48 px) |
| 20 | Entwicklungsmodus ohne produktive E-Mail/KI | Standard-`.env.example`: Sandbox + Regel-KI | CI läuft vollständig ohne Secrets |

## Zusätzliche Demo-Szenarien

- **Schnellerfassung offline**: Kontrolle → «Schnellerfassung» → Netzwerk im Browser auf «Offline» → Foto,
  «Abweichung», Titel, «Mittel», Speichern → Banner zeigt ausstehende Erfassung → wieder online → automatische Synchronisation.
- **Polier**: `b.huber@hochbau.example` → Massnahmen → Status «In Bearbeitung», Nachweis-Foto; «Verifiziert» nicht wählbar.
- **Management**: `gl@tozzo-gruppe.example` → Management-Ansicht, PDF/Excel-Export; keine Erfassungsfunktionen.
- **Katalog-Governance**: `sibe@tozzo-gruppe.example` → Verwaltung → Referenz ergänzen (neue Version) → «Prüfen und freigeben».
- **Einstellungen**: `admin@…` → KI-Freigabe, GPS-Entfernung, Scoring anpassen → «Wiederkehrende Abweichungen» → «Neu berechnen».
