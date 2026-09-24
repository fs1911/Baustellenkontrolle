# Datenmodell

Quelle der Wahrheit: `supabase/migrations/*.sql`. Alle Tabellen im Schema `public` haben RLS aktiviert.
Konventionen: UUID-Primärschlüssel, `created_at/updated_at`, `created_by/updated_by` (automatisch per
Trigger aus der Sitzung), `company_id` als Mandantenbezug, `deleted_at` für Soft Delete, Enums für Status.

## Entitäten

| Tabelle | Zweck | Wichtige Regeln |
|---|---|---|
| `auth.users` | Konten (Supabase Auth) | lokal: bcrypt-Passwort (`pgcrypto`) |
| `user_profiles` | Name, geschäftliche E-Mail, Funktion, aktiv | nur Admin darf (de)aktivieren (Trigger) |
| `roles` | Rollenkatalog (`app_role`) | admin, group_ims, project_manager, site_foreman, viewer |
| `user_roles` | Rolle je Benutzer, `company_id` NULL = gruppenweit | gruppenweit nur admin/group_ims/viewer (CHECK) |
| `companies` | Gesellschaften inkl. Farbe, Verteiler, Disclaimer, Kürzel | Kürzel `^[A-Z0-9]{2,8}$`, Farbe `#RRGGBB` |
| `company_logos` | Logos (Storage-Pfad), genau ein aktives je Gesellschaft | nur PNG/JPEG (SVG wird gerastert) |
| `projects`, `construction_sites` | Projekte, Baustellen mit Adresse/Kanton | Nummer eindeutig je Gesellschaft |
| `site_memberships` | Zuordnung Benutzer ↔ Baustelle mit Funktion | PL, Polier, Lesend |
| `finding_categories`, `finding_subcategories` | Katalog inkl. Schlagworte, Risikostandard, Muster-Massnahme | administrierbar |
| `legal_references` | Referenzen mit Typ, Quelle, Link, Abrufdatum, Version, Prüfstatus | `approved` nur mit Prüfer+Zeitpunkt; Versionskette `supersedes_id` |
| `category_reference_mappings` | Kategorie/Unterkategorie ↔ Referenz | eindeutig |
| `inspection_templates` | Kontrollvorlagen mit häufigen Feststellungen (JSON) | gruppenweit oder je Gesellschaft |
| `report_templates` | Berichtsvorlagen (Konfiguration) | Erweiterungspunkt |
| `inspections` | Kontrolle: **genau eine Gesellschaft und Baustelle** | Gesellschaft muss zur Baustelle passen (Trigger); abgeschlossen ⇒ `completed_at` |
| `inspection_participants` | anwesende Personen | erbt Gesellschaft |
| `findings` | Feststellung (**genau eine Kontrolle**) | siehe Constraints unten; Volltext `search_text` (german), Trigramm-Index |
| `finding_images` | Fotos (Pfad, Thumbnail, Legende, Grösse, Metadaten entfernt) | max. 15 MB, nur JPEG/PNG/WebP |
| `finding_references` | Referenzen je Feststellung (inkl. «von KI vorgeschlagen») | |
| `corrective_actions` | Massnahmen mit Verantwortung, Frist, Status, Abschluss/Verifikation | Polier-Einschränkungen (Trigger) |
| `action_updates` | Verlauf/Kommentare je Massnahme (unveränderlich) | Autor = Sitzung |
| `attachments` | Nachweise (z. B. Abschlussfotos), Referenzdokumente | |
| `generated_reports` | Bericht je Kontrolle (**genau einer**), Berichtsnummer `KÜRZEL-JAHR-NNNN` | Nummer per Zähler je Gesellschaft/Jahr |
| `report_versions` | unveränderliche Snapshots; final ⇒ PDF-Pfad + SHA-256 | keine Update-/Delete-Policy |
| `email_deliveries` | Versandprotokoll: Empfänger, Betreff, Text, Version, Status, Versuche, Fehler | nur für finale Version (Trigger) |
| `recurring_issue_clusters`, `..._members` | Snapshot wiederkehrender Muster inkl. Punkteaufschlüsselung | nur Job schreibt |
| `ai_suggestions` | jeder KI-/Regelvorschlag mit Provider, Input-Hash, Entscheidung | accepted/modified/rejected |
| `audit_logs` | Protokoll aller wesentlichen Änderungen und Ereignisse | nur Admin lesbar, niemand änderbar |
| `notification_settings` | Benachrichtigungspräferenzen | nur eigene |
| `system_settings` | KI-Freigaben, Metadaten, Aufbewahrung, Scoring, Berichtstexte | nur Admin schreibt |
| `report_counters` | Laufnummern Berichte | nur über Funktion |

## Constraints (Auswahl)

- `findings_status_check`: positive Feststellungen ohne Status, Abweichungen/Verbesserungen immer mit Status.
- `findings_risk_check`: Abweichungen/Verbesserungen benötigen eine Risikostufe.
- `findings_closed_check`: Status «geschlossen» nur mit `closed_at` **und** Abschlussbemerkung.
- `findings_critical_check`: kritische Abweichung nur mit Kategorie, verantwortlicher Rolle und Status.
- `corrective_actions_resolved_check` / `_verified_check`: Behoben ⇒ Erledigungsdatum; Verifiziert/Geschlossen ⇒ Verifikationsdatum, -person und -bemerkung.
- `generated_reports_release_check`: freigegeben/versendet ⇒ Freigabezeitpunkt und -person.
- `report_versions_final_check`: finale Version ⇒ PDF-Pfad und Prüfsumme.
- `email_deliveries_sent_check`, Trigger `email_deliveries_version_check` (nur finale Versionen).
- Mandantenbezug: `company_id`/`site_id` von Kindtabellen werden per Trigger immer vom Elternobjekt abgeleitet
  (kein Einschleusen fremder Mandanten möglich).
- Statussynchronisation: Feststellungsstatus = am wenigsten fortgeschrittener Status ihrer Massnahmen.

## Indizes

Dashboard-Abfragen: `inspections(company_id|site_id, inspected_at)`, `findings(company_id, created_at)`,
`findings(site_id, category_id, created_at)`, `findings(subcategory_id, created_at)`, offene Massnahmen nach
Frist (`corrective_actions(company_id, due_date) where status in (open, in_progress)`), Volltext (GIN auf
`search_text`), Trigramm (GIN auf `title`), Audit nach Objekt und Zeit.

## Migrationen

| Datei | Inhalt |
|---|---|
| `…001_foundation` | Extensions, Schema `app`, Enums, `app.uid()`, Touch-Trigger |
| `…002_core_tables` | Tabellen, Constraints, Indizes |
| `…003_integrity` | Scope-Ableitung, Laufnummern, Statussync, Polier-Einschränkungen |
| `…004_security_rls` | Berechtigungsfunktionen, Grants, RLS-Policies |
| `…005_audit_storage` | Audit-Trigger, `app.log_event`, Buckets, Storage-Policies |
| `…006_offline_sync` | `client_ref` für idempotente Offline-Synchronisation |
| `…007_viewer_scope` | Lesende sehen abgeschlossene Kontrollen (Entwürfe nie) |
