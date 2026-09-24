# Annahmen und offene Punkte

Getroffene Annahmen, wo Informationen nicht ableitbar waren. Jede Annahme ist im Code bzw. in den
Einstellungen änderbar.

## Organisation und Rollen

1. **Rollen gelten gruppenweit oder je Gesellschaft.** Projektleitende und Poliere sehen nur Baustellen, denen
   sie per `site_memberships` zugeordnet sind. Eine Projektleiter-Rolle auf Gesellschaftsebene berechtigt zusätzlich
   zum Anlegen neuer Baustellen in dieser Gesellschaft (automatische Zuordnung).
2. **«Zugewiesene Berichte» für Poliere** = alle Kontrollen/Berichte ihrer zugeordneten Baustellen.
3. **Lesende/Management** sehen abgeschlossene Kontrollen und freigegebene/versendete Berichte, nie Entwürfe in Erfassung.
4. **Freigabe und Versand** dürfen Admin, Gruppen-IMS/SIBE und Projektleitende (für ihre Baustellen).
   Freie Empfänger inkl. externer Adressen, CC und BCC nur Admin/IMS; Projektleitende senden an sich selbst,
   den Standardverteiler der Gesellschaft und Beteiligte der Baustelle.
5. **Verifikation/Abschluss** von Massnahmen nur Projektleitung/IMS/Admin; Poliere setzen bis «Behoben».

## Fachlich

6. Ein Bericht je Kontrolle, beliebig viele Versionen; jede Freigabe erzeugt eine neue finale Version.
7. Berichtsnummer `KÜRZEL-JAHR-NNNN`, fortlaufend je Gesellschaft und Kalenderjahr (Zürcher Zeit).
8. Eine primäre Massnahme je Feststellung im Formular (Datenmodell unterstützt mehrere).
9. Positive Feststellungen haben keinen Massnahmenstatus.
10. Schnellerfassung ohne explizite Massnahme erhält «Massnahme durch Bauleitung festzulegen (Schnellerfassung)».
11. Kontrolltypen: Routine, unangemeldet, Nachkontrolle, Begehung/Abnahme, IMS-Begehung, Sonderkontrolle.
12. «Überfällig» = Status offen/in Bearbeitung und Frist vor heute (Europe/Zurich).
13. Baustellen mit Handlungsbedarf: kritisch offen ×4, hoch offen ×3, überfällig ×2, aktive Cluster ×2.
14. Initialer Referenzkatalog: bewusst ohne Artikelnummern/Links, Status «zu prüfen» (siehe Governance).

## Technisch

15. Keine produktive Supabase-Instanz für dieses Projekt vorhanden; Entwicklung/Tests gegen `supabase/postgres:15.8.1.085`.
16. Keine E-Mail-/M365-Integration verfügbar → Sandbox; Graph/SMTP implementiert und dokumentiert.
17. Kein KI-Key → regelbasierter Klassifikator; Anthropic-Adapter (Standardmodell `claude-opus-5`, über `AI_MODEL` änderbar).
18. HEIC: Browser konvertieren bei der Kamera-Aufnahme i. d. R. nach JPEG; zusätzlich clientseitige Umwandlung
    via Canvas. Serverseitig wird HEVC-HEIC nicht dekodiert (sharp-Standardbuild).
19. Microsoft Graph: Anhänge bis 3 MB im Direktversand; grössere Berichte benötigen Upload-Session (Erweiterung).
20. Benachrichtigungen (Zuweisung/Überfälligkeit/Wochenbericht) sind als Präferenzen vorbereitet, der Versandjob ist noch nicht umgesetzt.
21. Nur heller Modus (Sonnenlicht-Lesbarkeit), Dark Mode als Erweiterung.

## Offene Entscheide für den Betreiber

- Hosting (z. B. Vercel/Netlify/Railway/Container in CH) und Supabase-Region (EU/CH) inkl. Auftragsbearbeitung.
- Freigabe externer KI-Verarbeitung (DSG-Abklärung, Einwilligung/Information der Mitarbeitenden).
- Verbindliche Aufbewahrungsfristen (derzeit Vorschläge).
- Finaler Datenschutztext und verantwortliche Stelle.
