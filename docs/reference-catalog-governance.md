# Governance Kategorien- und Referenzkatalog

## Grundsatz

Der Referenzkatalog ist eine **Orientierungshilfe** für Kontrollen und Berichte. Er ist weder vollständig
noch rechtsverbindlich. Die Anwendung erzeugt keine Rechtsaussagen; Berichte enthalten stets den Hinweis,
dass eine fachliche bzw. rechtliche Würdigung im Einzelfall vorbehalten bleibt.

## Initialbestand

- 20 Hauptkategorien mit 50 Unterkategorien, Schlagworten, Risikostandard und Muster-Massnahmen
  (`src/lib/domain/catalog-data.ts`).
- 39 Referenzen (BauAV, VUV, ArGV 3, EKAS-Richtlinien 6508/6512, Suva-Checklisten und lebenswichtige Regeln,
  Kranverordnung, NIV, ChemV, VKF, GSchG, VVEA, LRV, SIA 118, ISO 45001/9001/14001, interne Weisungen als Platzhalter).
- **Alle Referenzen haben den Status «zu prüfen».** Es wurden bewusst **keine** Artikelnummern,
  Checklisten-Nummern oder Links hinterlegt, die nicht verifiziert werden konnten (z. B. «BauAV – Absturzsicherung
  (Abschnitt zu prüfen)»). Bei ISO-Normen sind nur Kapitelnummern angegeben, die der Normstruktur entsprechen.
- Es wurden keine externen Rechtsquellen automatisiert abgerufen (kein verlässlicher Connector verfügbar).

## Prüf- und Freigabeprozess

| Schritt | Wer | In der App |
|---|---|---|
| 1. Fundstelle verifizieren (Artikel/Kapitel, gültige Fassung) | IMS/SIBE | Verwaltung → Kategorien und Referenzkatalog → Referenz |
| 2. Link (nur https), Quelle, Abrufdatum, Stand/Version erfassen | IMS/SIBE | «Neue Version speichern» → neue Version, Status «zu prüfen», Vorversion inaktiv |
| 3. Fachliche Prüfung und Freigabe mit Prüfvermerk | IMS-Leitung / SIBE | «Prüfen und freigeben» (Prüfer und Zeitpunkt werden gespeichert; DB erzwingt beides) |
| 4. Zuordnung zu Kategorien pflegen | IMS/SIBE | Checkboxen «Verknüpfte Kategorien» |
| 5. Ausser Kraft setzen bei Rechtsänderung | IMS/SIBE | «Ausser Kraft setzen» – bleibt in bestehenden Berichten nachvollziehbar |
| 6. Periodische Überprüfung (empfohlen jährlich bzw. bei Revisionen von BauAV/VUV/EKAS/Suva) | IMS | Filter nach Status/Abrufdatum |

Berechtigt sind Administratoren und Gruppen-IMS/SIBE (RLS). Jede Änderung wird im Audit Log protokolliert.
In Berichten werden nicht freigegebene Referenzen mit «(Zu prüfen)» gekennzeichnet.

## Versionierung

Änderungen erzeugen immer einen neuen Datensatz (`version_no + 1`, `supersedes_id` → Vorversion). Feststellungen
und Berichts-Snapshots verweisen auf die zum Erfassungszeitpunkt gültige Version, damit frühere Berichte
unverändert reproduzierbar bleiben.

## Kategorien und Schlagworte

Schlagworte steuern den regelbasierten Klassifikator. Empfehlung: Synonyme und Baustellen-Jargon
(z. B. «Bordbrett», «Knieleiste») ergänzen, Mehrdeutiges vermeiden (kurze Begriffe werden nur als ganze
Wörter erkannt, mittellange nur am Wortanfang). Änderungen wirken sofort auf neue Vorschläge.

## Aufgaben für das IMS-/SIBE-Team (vor Produktivsetzung)

1. Alle 39 Referenzen prüfen, konkrete Fundstellen, Links (fedlex.admin.ch, ekas.ch, suva.ch), Abrufdatum und Stand ergänzen, freigeben.
2. Interne Weisungen (Platzhalter) durch reale Dokumente/Versionen ersetzen.
3. Kategorien, Unterkategorien, Risikostandards und Muster-Massnahmen fachlich bestätigen.
4. Kontrollvorlagen (häufige Feststellungen) je Gesellschaft festlegen.
5. Disclaimer- und Schlusstexte je Gesellschaft juristisch prüfen lassen.
