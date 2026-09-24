# E-Mail-Integration

Implementierung: `src/lib/services/mail/index.ts` (Adapter), Vorlage und Empfängerregeln `src/lib/domain/email.ts`,
Ablauf `src/lib/services/reports/service.ts`.

## Ablauf «Bericht freigeben und senden»

1. Berechtigung (Edit-Recht auf Baustelle) und Empfängerregeln prüfen (siehe `assumptions.md` Nr. 4), Adressen validieren.
2. Finale Berichtsversion erzeugen, PDF rendern, SHA-256 berechnen, PDF privat speichern.
3. Bericht auf «Freigegeben» setzen, Ereignis `release` protokollieren.
4. Versandprotokoll anlegen (`queued` → `sending`), E-Mail mit PDF-Anhang versenden.
5. Erfolg: `sent`, Zeitpunkt, Provider-Message-ID, Bericht «Versendet», Ereignis `send`.
   Fehler: `failed` mit verständlicher Meldung, Bericht «Versand fehlgeschlagen», Retry durch Absender oder Admin/IMS.

Nie ohne explizite Bestätigung (Checkbox im Dialog + Klick). Betreff-Standard:
`Baustellenkontrollbericht – [Gesellschaft] – [Baustelle] – [Datum]`. Text (bearbeitbar) enthält
Gesellschaft, Baustelle, Datum, Kurzübersicht, Summary und Hinweis auf den Anhang; HTML-Version im
Farbschema der Gesellschaft mit Disclaimer. Absendername = E-Mail-Absendername der Gesellschaft,
Reply-To = geschäftliche Adresse des Absenders.

## Provider

### Sandbox (Standard Entwicklung)
`MAIL_PROVIDER=sandbox` – schreibt `.eml` + Metadaten nach `MAIL_SANDBOX_DIR`; einsehbar unter Verwaltung → Mail-Sandbox.

### Microsoft 365 / Microsoft Graph (empfohlen)
1. Entra ID → App-Registrierung, Anwendungsberechtigung **Mail.Send** (Application), Admin-Zustimmung.
2. Zugriff auf das Versandpostfach beschränken (Exchange Online):
   `New-ApplicationAccessPolicy -AppId <client-id> -PolicyScopeGroupId <postfach-oder-gruppe> -AccessRight RestrictAccess`.
3. Variablen: `MAIL_PROVIDER=graph`, `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET`,
   `GRAPH_SENDER_MAILBOX` (z. B. `baustellenkontrolle@tozzo.ch`), `MAIL_FROM_ADDRESS` (gleich).
4. Grenze: Direktversand bis 3 MB Anhang; für grössere PDFs Upload-Session (`createUploadSession`) ergänzen.
   Gesendete Elemente werden im Postfach gespeichert (`saveToSentItems`).

Hinweis: Versand im Namen des *angemeldeten* Benutzers (delegierte Berechtigung) ist möglich, erfordert aber
Entra-ID-Login mit `Mail.Send`-Delegation und Token-Weitergabe; derzeit wird ein zentrales Versandpostfach mit
Reply-To des Benutzers verwendet (einfacher, revisionssicher).

### SMTP
`MAIL_PROVIDER=smtp`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE`, `MAIL_FROM_ADDRESS`.

## Tests
`tests/integration/report.test.ts` (Versand über Sandbox, Protokoll, Audit, Empfängerregeln, Retry-Regel),
`tests/e2e/core-flow.spec.ts` (UI-Ablauf inkl. Bestätigungsdialog).
