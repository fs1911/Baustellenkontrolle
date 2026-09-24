/**
 * Demo- und Entwicklungsdaten.
 *
 *   npm run db:seed            – setzt alle Fachdaten zurück und legt Demo-Daten an
 *
 * Läuft nur ausserhalb von Produktion. Alle Demo-Benutzer erhalten das Passwort aus DEMO_PASSWORD
 * (Standard: "Baustelle!2026"). Bilder sind synthetisch erzeugte, sichere Platzhalter.
 */
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { closeDb, withService, type Tx } from "@/lib/db/client";
import { SEED_CATEGORIES, SEED_REFERENCES } from "@/lib/domain/catalog-data";
import type { ActionStatus, Assessment, InspectionType, RiskLevel } from "@/lib/domain/enums";
import { DEFAULT_SCORING_CONFIG } from "@/lib/domain/recurrence";
import { processLogo, processPhoto } from "@/lib/services/images";
import { storage } from "@/lib/services/storage";
import { recomputeRecurringClusters } from "@/lib/services/recurrence-job";

if (process.env.APP_ENV === "production" && !process.argv.includes("--force")) {
  console.error("Seed in Produktion verweigert.");
  process.exit(1);
}

const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "Baustelle!2026";
const NOW = new Date();
const DAY = 86_400_000;

// Deterministischer Zufall für reproduzierbare Demo-Daten
let seedState = 20260924;
function rand(): number {
  seedState = (seedState * 1664525 + 1013904223) % 4294967296;
  return seedState / 4294967296;
}
function pick<T>(list: T[]): T {
  return list[Math.floor(rand() * list.length)];
}

// -----------------------------------------------------------------------------
// Stammdaten
// -----------------------------------------------------------------------------
const COMPANIES = [
  { key: "tozzo", name: "tozzo gruppe ag", short: "TOZ", street: "Industriestrasse 1", postal: "5242", city: "Birr", color: "#c2410c", distribution: ["ims@tozzo-gruppe.example"], sender: "tozzo gruppe ag – IMS" },
  { key: "hochbau", name: "Beispielgesellschaft Hochbau AG", short: "BHB", street: "Bahnhofstrasse 20", postal: "5000", city: "Aarau", color: "#1d4ed8", distribution: ["bauleitung@hochbau.example"], sender: "Hochbau AG – Bauleitung" },
  { key: "tiefbau", name: "Beispielgesellschaft Tiefbau AG", short: "BTB", street: "Werkhofweg 5", postal: "8050", city: "Zürich", color: "#15803d", distribution: ["tiefbau@tiefbau.example"], sender: "Tiefbau AG – Bauleitung" },
] as const;
type CompanyKey = (typeof COMPANIES)[number]["key"];

const SITES = [
  { key: "birr", company: "hochbau", number: "BHB-24-017", name: "Wohnüberbauung Birr", street: "Feldstrasse 12", postal: "5242", city: "Birr", canton: "AG", project: "P-2024-017" },
  { key: "aargau", company: "tozzo", number: "TOZ-25-004", name: "Sanierung Gewerbeobjekt Aargau", street: "Gewerbering 8", postal: "5600", city: "Lenzburg", canton: "AG", project: "P-2025-004" },
  { key: "strasse", company: "tiefbau", number: "BTB-25-009", name: "Infrastrukturprojekt Beispielstrasse", street: "Beispielstrasse", postal: "8952", city: "Schlieren", canton: "ZH", project: "P-2025-009" },
  { key: "zuerich", company: "hochbau", number: "BHB-25-031", name: "Mehrfamilienhaus Zürich Nord", street: "Wehntalerstrasse 400", postal: "8046", city: "Zürich", canton: "ZH", project: "P-2025-031" },
] as const;
type SiteKey = (typeof SITES)[number]["key"];

const USERS = [
  { key: "admin", name: "Andrea Keller", email: "admin@tozzo-gruppe.example", title: "Administratorin IMS", roles: [{ role: "admin", company: null }] },
  { key: "sibe", name: "Marco Bühler", email: "sibe@tozzo-gruppe.example", title: "SIBE Gruppe", roles: [{ role: "group_ims", company: null }] },
  { key: "pl_hochbau", name: "Sandra Meier", email: "s.meier@hochbau.example", title: "Projektleiterin Hochbau", roles: [{ role: "project_manager", company: "hochbau" }] },
  { key: "pl_tiefbau", name: "Luca Rossi", email: "l.rossi@tiefbau.example", title: "Bauleiter Tiefbau", roles: [{ role: "project_manager", company: "tiefbau" }] },
  { key: "pl_tozzo", name: "Nina Frei", email: "n.frei@tozzo-gruppe.example", title: "Projektleiterin Sanierungen", roles: [{ role: "project_manager", company: "tozzo" }] },
  { key: "polier_birr", name: "Beat Huber", email: "b.huber@hochbau.example", title: "Polier", roles: [] },
  { key: "mgmt", name: "Christine Weber", email: "gl@tozzo-gruppe.example", title: "Geschäftsleitung", roles: [{ role: "viewer", company: null }] },
] as const;
type UserKey = (typeof USERS)[number]["key"];

const MEMBERSHIPS: { user: UserKey; site: SiteKey; role: "project_manager" | "site_foreman" | "viewer" }[] = [
  { user: "pl_hochbau", site: "birr", role: "project_manager" },
  { user: "pl_hochbau", site: "zuerich", role: "project_manager" },
  { user: "pl_tiefbau", site: "strasse", role: "project_manager" },
  { user: "pl_tozzo", site: "aargau", role: "project_manager" },
  { user: "polier_birr", site: "birr", role: "site_foreman" },
];

// -----------------------------------------------------------------------------
// Feststellungsvorlagen (fachlich realistische Beispiele)
// -----------------------------------------------------------------------------
interface FindingTemplate {
  sub: string;
  assessment: Assessment;
  risk: RiskLevel | null;
  title: string;
  description: string;
  action?: string;
  role?: string;
  trade: string;
  location?: string;
}

const T: Record<string, FindingTemplate[]> = {
  "absturz.seitenschutz": [
    { sub: "absturz.seitenschutz", assessment: "negative", risk: "high", title: "Seitenschutz am Deckenrand fehlt", description: "Am Deckenrand im 2. OG fehlt auf ca. 8 m Länge der Seitenschutz. Absturzhöhe rund 6 m.", action: "Dreiteiligen Seitenschutz (Geländer-, Zwischenholm, Bordbrett) montieren; Bereich bis dahin sperren.", role: "Polier", trade: "Rohbau", location: "2. OG, Nordseite" },
    { sub: "absturz.seitenschutz", assessment: "negative", risk: "critical", title: "Ungesicherte Absturzkante Treppenhaus", description: "Treppenhauskern ohne Seitenschutz, Mitarbeitende arbeiten direkt an der Kante. Absturzhöhe über 3 m.", action: "Arbeiten an der Kante sofort einstellen, Seitenschutz montieren, Instruktion durchführen.", role: "Polier", trade: "Rohbau", location: "Treppenhaus B" },
    { sub: "absturz.seitenschutz", assessment: "negative", risk: "high", title: "Seitenschutz demontiert und nicht wieder erstellt", description: "Seitenschutz für Materialumschlag entfernt und nicht wieder montiert.", action: "Seitenschutz wiederherstellen; Umschlagstelle mit Absturzsicherung (Tor) ausrüsten.", role: "Polier", trade: "Rohbau", location: "Anlieferung Kran" },
  ],
  "absturz.dach": [
    { sub: "absturz.dach", assessment: "negative", risk: "critical", title: "Lichtkuppeln auf Flachdach nicht gesichert", description: "Drei Lichtkuppeln ohne durchbruchsichere Abdeckung, Dachdecker arbeiten in unmittelbarer Nähe.", action: "Lichtkuppeln mit durchbruchsicheren Gittern oder Abdeckungen sichern.", role: "Subunternehmer Gebäudehülle", trade: "Gebäudehülle", location: "Flachdach" },
  ],
  "geruest.belag": [
    { sub: "geruest.belag", assessment: "negative", risk: "high", title: "Gerüstbelag unvollständig", description: "Auf Gerüstlage 3 fehlen zwei Belagsteile, Lücke von ca. 60 cm.", action: "Fehlende Belagsteile durch Gerüstbauer ersetzen lassen; Lage bis dahin sperren.", role: "Gerüstbauer", trade: "Gerüstbau", location: "Fassade Süd" },
  ],
  "geruest.freigabe": [
    { sub: "geruest.freigabe", assessment: "positive", risk: null, title: "Gerüst vorbildlich erstellt und freigegeben", description: "Fassadengerüst vollständig, Freigabe gut sichtbar am Zugang angebracht, Treppenturm vorhanden.", trade: "Gerüstbau", location: "Fassade West" },
    { sub: "geruest.freigabe", assessment: "improvement", risk: "low", title: "Gerüstfreigabe besser sichtbar anbringen", description: "Gerüstfreigabe vorhanden, jedoch nur im Baubüro. Sie sollte am Zugang ersichtlich sein.", action: "Gerüstkarte am Aufgang anbringen.", role: "Bauleitung", trade: "Gerüstbau" },
  ],
  "leitern.zustand": [
    { sub: "leitern.zustand", assessment: "negative", risk: "medium", title: "Beschädigte Anstellleiter im Einsatz", description: "Anstellleiter mit angerissener Sprosse wird als Zugang zur Schalung verwendet.", action: "Leiter ausser Betrieb nehmen und ersetzen; Treppenturm als Zugang prüfen.", role: "Polier", trade: "Rohbau" },
  ],
  "oeffnungen.abdeckung": [
    { sub: "oeffnungen.abdeckung", assessment: "negative", risk: "high", title: "Bodenöffnung nur lose abgedeckt", description: "Aussparung für Installationen mit loser Platte abgedeckt, nicht fixiert und nicht beschriftet.", action: "Abdeckung tragfähig ausführen, fixieren und mit «Öffnung» beschriften.", role: "Polier", trade: "Rohbau", location: "1. OG, Wohnung 1.3" },
  ],
  "psa.helm": [
    { sub: "psa.helm", assessment: "negative", risk: "medium", title: "Mitarbeitende ohne Schutzhelm", description: "Zwei Mitarbeitende im Kranbereich ohne Schutzhelm angetroffen.", action: "Mitarbeitende direkt ansprechen; Helmtragpflicht im Toolbox-Meeting wiederholen.", role: "Polier", trade: "Rohbau" },
    { sub: "psa.helm", assessment: "negative", risk: "medium", title: "Helmtragpflicht nicht eingehalten", description: "Mitarbeitende eines Subunternehmers arbeiten ohne Schutzhelm unter dem Gerüst.", action: "Subunternehmer schriftlich auf Helmtragpflicht hinweisen, Nachkontrolle.", role: "Subunternehmer", trade: "Fassade" },
  ],
  "psa.gehoer_augen": [
    { sub: "psa.gehoer_augen", assessment: "negative", risk: "medium", title: "Kein Gehörschutz beim Spitzen", description: "Spitzarbeiten mit Abbruchhammer ohne Gehör- und Augenschutz.", action: "Gehörschutz und Schutzbrille abgeben und tragen; Instruktion.", role: "Polier", trade: "Rückbau" },
  ],
  "psa.warn": [
    { sub: "psa.warn", assessment: "positive", risk: null, title: "Warnkleidung konsequent getragen", description: "Alle Mitarbeitenden im Strassenbereich tragen Warnkleidung Klasse 3 – vorbildlich.", trade: "Strassenbau" },
  ],
  "elektro.provisorium": [
    { sub: "elektro.provisorium", assessment: "negative", risk: "high", title: "Elektrisches Provisorium mit Mehrfachsteckern", description: "Provisorische Beleuchtung über Mehrfachstecker und nicht vollständig abgewickelte Kabelrolle betrieben.", action: "Provisorium durch Elektrofachperson fachgerecht erstellen lassen; Kabelrollen ganz abwickeln.", role: "Subunternehmer Elektro", trade: "Elektro", location: "UG Technikraum" },
    { sub: "elektro.provisorium", assessment: "negative", risk: "high", title: "Provisorische Beleuchtung ungeschützt", description: "Leuchten des Provisoriums hängen an beschädigten Kabeln im Treppenhaus.", action: "Provisorium instand stellen, Kabel geschützt und hochgeführt verlegen.", role: "Subunternehmer Elektro", trade: "Elektro", location: "Treppenhaus" },
  ],
  "elektro.kabel": [
    { sub: "elektro.kabel", assessment: "negative", risk: "high", title: "Beschädigtes Verlängerungskabel", description: "Verlängerungskabel mit beschädigter Isolation liegt in einer Wasserlache.", action: "Kabel sofort entfernen und ersetzen; Kabelführung hochgelegt.", role: "Polier", trade: "Innenausbau" },
  ],
  "elektro.verteiler": [
    { sub: "elektro.verteiler", assessment: "negative", risk: "critical", title: "Baustromverteiler offen", description: "Baustromverteiler mit offener Abdeckung, spannungsführende Teile zugänglich.", action: "Verteiler sofort schliessen, durch Elektrofachperson prüfen lassen, FI-Schutz testen.", role: "Subunternehmer Elektro", trade: "Elektro", location: "Installationsplatz" },
  ],
  "krane.anschlagmittel": [
    { sub: "krane.anschlagmittel", assessment: "negative", risk: "high", title: "Ablegereifes Hebeband im Einsatz", description: "Hebeband mit Schnittverletzung und fehlender Etikette wird weiter verwendet.", action: "Hebeband entsorgen; Anschlagmittel regelmässig prüfen und dokumentieren.", role: "Kranführer", trade: "Rohbau" },
  ],
  "verkehr.fluchtweg": [
    { sub: "verkehr.fluchtweg", assessment: "negative", risk: "medium", title: "Fluchtweg durch Material verstellt", description: "Fluchtweg im UG durch Paletten mit Dämmmaterial blockiert.", action: "Fluchtweg freiräumen und Lagerplatz ausserhalb bezeichnen.", role: "Polier", trade: "Innenausbau" },
  ],
  "ordnung.stolper": [
    { sub: "ordnung.stolper", assessment: "negative", risk: "low", title: "Unordnung und Stolperstellen im Treppenhaus", description: "Schalungsreste, Kabel und Verpackungsmaterial liegen im Treppenhaus herum.", action: "Treppenhaus aufräumen; tägliche Aufräumzeit festlegen.", role: "Polier", trade: "Rohbau", location: "Treppenhaus A" },
    { sub: "ordnung.stolper", assessment: "negative", risk: "medium", title: "Herumliegendes Material auf Verkehrsweg", description: "Bewehrungseisen und Abfall liegen auf dem Hauptverkehrsweg, erhebliche Stolpergefahr.", action: "Verkehrsweg räumen; Material geordnet lagern.", role: "Polier", trade: "Rohbau" },
    { sub: "ordnung.stolper", assessment: "improvement", risk: "low", title: "Ordnung auf den Etagen verbessern", description: "Grundsätzlich ordentlich, Abfallbehälter auf den Etagen könnten häufiger geleert werden.", action: "Leerungsintervall der Etagenbehälter erhöhen.", role: "Bauleitung", trade: "Allgemein" },
  ],
  "ordnung.lager": [
    { sub: "ordnung.lager", assessment: "positive", risk: null, title: "Materiallager sauber organisiert", description: "Lagerplätze beschriftet, Material standsicher und ordnungsgemäss gelagert.", trade: "Logistik" },
  ],
  "graben.verbau": [
    { sub: "graben.verbau", assessment: "negative", risk: "critical", title: "Graben ohne Verbau über 1.5 m tief", description: "Leitungsgraben ca. 1.8 m tief mit senkrechten Wänden ohne Verbau, Mitarbeitende im Graben.", action: "Arbeiten im Graben sofort stoppen, Grabenverbau erstellen oder Böschung abflachen.", role: "Vorarbeiter Tiefbau", trade: "Tiefbau", location: "Abschnitt 2" },
  ],
  "graben.rand": [
    { sub: "graben.rand", assessment: "negative", risk: "high", title: "Aushub direkt am Grabenrand", description: "Aushubmaterial direkt am Grabenrand gelagert, Einsturzgefahr und kein sicherer Zugang.", action: "Aushub mindestens 0.5 m vom Grabenrand entfernt lagern, Leiter als Zugang stellen.", role: "Vorarbeiter Tiefbau", trade: "Tiefbau" },
  ],
  "gefahrstoffe.lagerung": [
    { sub: "gefahrstoffe.lagerung", assessment: "negative", risk: "medium", title: "Kanister ohne Auffangwanne", description: "Dieselkanister und Schalöl ohne Auffangwanne neben dem Meteorwasserschacht gelagert.", action: "Lagerung in Auffangwanne, Gebinde verschliessen, Schacht schützen.", role: "Polier", trade: "Tiefbau" },
  ],
  "staub_laerm.staub": [
    { sub: "staub_laerm.staub", assessment: "improvement", risk: "medium", title: "Staubentwicklung beim Trennen reduzieren", description: "Beim Trennen von Betonplatten starke Staubentwicklung. Nassschneiden oder Absaugung wäre zweckmässig.", action: "Nassschneidverfahren bzw. Absaugung einsetzen, FFP2-Masken abgeben.", role: "Polier", trade: "Rückbau" },
  ],
  "brand.loeschmittel": [
    { sub: "brand.loeschmittel", assessment: "positive", risk: null, title: "Feuerlöscher geprüft und gut sichtbar", description: "Feuerlöscher an allen Etagen vorhanden, geprüft und gut sichtbar signalisiert.", trade: "Allgemein" },
  ],
  "brand.heissarbeiten": [
    { sub: "brand.heissarbeiten", assessment: "negative", risk: "high", title: "Schweissarbeiten ohne Brandwache", description: "Schweissarbeiten neben brennbarem Dämmmaterial ohne Löschmittel und Brandwache.", action: "Heissarbeitsbewilligung einführen, Löschmittel bereitstellen, Brandwache organisieren.", role: "Subunternehmer Metallbau", trade: "Metallbau" },
  ],
  "notfall.plan": [
    { sub: "notfall.plan", assessment: "positive", risk: null, title: "Notfallplan aktuell ausgehängt", description: "Notfallplan mit Notfallnummern, Standortangaben und Ersthelfenden im Baubüro und am Eingang ausgehängt.", trade: "Allgemein" },
  ],
  "notfall.material": [
    { sub: "notfall.material", assessment: "negative", risk: "medium", title: "Sanitätskasten unvollständig", description: "Sanitätskasten im Baubüro unvollständig, Augenspülflasche abgelaufen.", action: "Erste-Hilfe-Material ergänzen, monatliche Kontrolle festlegen.", role: "Bauleitung", trade: "Allgemein" },
  ],
  "instruktion.nachweis": [
    { sub: "instruktion.nachweis", assessment: "negative", risk: "medium", title: "Instruktion neuer Mitarbeitender nicht nachgewiesen", description: "Für zwei temporäre Mitarbeitende liegt kein Instruktionsnachweis vor.", action: "Instruktion nachholen und mit Unterschrift dokumentieren.", role: "Bauleitung", trade: "Allgemein" },
  ],
  "instruktion.av": [
    { sub: "instruktion.av", assessment: "positive", risk: null, title: "Toolbox-Meeting zu Absturzsicherung durchgeführt", description: "Wöchentliches Toolbox-Meeting zum Thema Absturzsicherung mit Teilnehmerliste dokumentiert – gute Praxis.", trade: "Allgemein" },
  ],
  "umwelt.abfall": [
    { sub: "umwelt.abfall", assessment: "improvement", risk: "low", title: "Abfalltrennung optimieren", description: "Mulden sind nicht beschriftet, Holz und Mischabfall werden teilweise gemischt.", action: "Mulden beschriften und Abfalltrennung instruieren.", role: "Bauleitung", trade: "Allgemein" },
  ],
  "umwelt.gewaesser": [
    { sub: "umwelt.gewaesser", assessment: "negative", risk: "high", title: "Betonwasser in Meteorwasserschacht", description: "Betonwasser der Waschstelle fliesst ungeklärt in einen Meteorwasserschacht.", action: "Absetzbecken und Neutralisation einrichten, Schacht abdecken.", role: "Polier", trade: "Tiefbau" },
  ],
  "qualitaet.ausfuehrung": [
    { sub: "qualitaet.ausfuehrung", assessment: "negative", risk: "low", title: "Abweichung Bewehrungsüberdeckung", description: "Stichprobe zeigt ungenügende Distanzhalter, Bewehrungsüberdeckung teilweise unter Planvorgabe.", action: "Distanzhalter ergänzen, Abnahme vor Betonage durch Bauleitung.", role: "Polier", trade: "Rohbau" },
  ],
  "qualitaet.schutz": [
    { sub: "qualitaet.schutz", assessment: "improvement", risk: "low", title: "Schutz fertiger Fensterbänke", description: "Fertig montierte Fensterbänke sind nicht abgedeckt; Beschädigungen könnten vermieden werden.", action: "Fensterbänke mit Schutzprofilen abdecken.", role: "Bauleitung", trade: "Innenausbau" },
  ],
  "nachhaltigkeit.energie": [
    { sub: "nachhaltigkeit.energie", assessment: "improvement", risk: "low", title: "Bauheizung und Beleuchtung bedarfsgerecht steuern", description: "Bauheizung läuft bei offenen Fenstern, Beleuchtung brennt über Nacht. Zeitschaltuhren wären sinnvoll.", action: "Zeitschaltuhren einsetzen, Leerlaufregelung kommunizieren.", role: "Bauleitung", trade: "Allgemein" },
  ],
  "organisation.signalisation": [
    { sub: "organisation.signalisation", assessment: "negative", risk: "medium", title: "Signalisation der Baustellenzufahrt fehlt", description: "Signalisation und Absperrung der Baustellenzufahrt fehlen teilweise; Fussgänger queren den Arbeitsbereich.", action: "Signalisation gemäss Signalisationsplan ergänzen, Fussgängerführung abtrennen.", role: "Vorarbeiter Tiefbau", trade: "Strassenbau", location: "Zufahrt Nord" },
    { sub: "organisation.signalisation", assessment: "negative", risk: "high", title: "Absperrung Gefahrenbereich mangelhaft", description: "Absperrung beim Grabenbereich umgefallen, Gefahrenbereich nicht signalisiert.", action: "Absperrung wiederherstellen und täglich kontrollieren.", role: "Vorarbeiter Tiefbau", trade: "Strassenbau" },
    { sub: "organisation.signalisation", assessment: "negative", risk: "medium", title: "Mangelhafte Beschilderung Umleitung", description: "Umleitungsbeschilderung für Fussgänger fehlt nach Phasenwechsel.", action: "Beschilderung an neue Bauphase anpassen.", role: "Bauleitung", trade: "Strassenbau" },
  ],
  "organisation.zutritt": [
    { sub: "organisation.zutritt", assessment: "negative", risk: "medium", title: "Bauzaun offen", description: "Bauzaun bei der Anlieferung steht offen, unbefugter Zutritt möglich.", action: "Bauzaun schliessen, Zutrittsregelung durchsetzen.", role: "Polier", trade: "Allgemein" },
  ],
};

// Kontrollplan: (Baustelle, Tage zurück, Kontrolleur, Typ, Feststellungsschlüssel)
const INSPECTIONS: { site: SiteKey; daysAgo: number; inspector: UserKey; type: InspectionType; weather: string; area: string; findings: string[] }[] = [
  { site: "birr", daysAgo: 170, inspector: "sibe", type: "routine", weather: "Sonnig, 18 °C", area: "Rohbau", findings: ["absturz.seitenschutz", "psa.helm", "ordnung.lager", "notfall.plan"] },
  { site: "birr", daysAgo: 130, inspector: "pl_hochbau", type: "routine", weather: "Bewölkt", area: "Rohbau", findings: ["ordnung.stolper", "geruest.freigabe", "leitern.zustand", "instruktion.av"] },
  { site: "birr", daysAgo: 84, inspector: "sibe", type: "unannounced", weather: "Regen", area: "Rohbau / Gerüst", findings: ["absturz.seitenschutz", "geruest.belag", "psa.helm", "ordnung.stolper", "brand.loeschmittel"] },
  { site: "birr", daysAgo: 55, inspector: "pl_hochbau", type: "follow_up", weather: "Sonnig", area: "Rohbau", findings: ["absturz.seitenschutz", "oeffnungen.abdeckung", "psa.warn", "instruktion.nachweis"] },
  { site: "birr", daysAgo: 26, inspector: "sibe", type: "routine", weather: "Sonnig, 24 °C", area: "Rohbau / Fassade", findings: ["absturz.seitenschutz", "psa.helm", "ordnung.stolper", "elektro.kabel", "geruest.freigabe"] },
  { site: "birr", daysAgo: 6, inspector: "sibe", type: "unannounced", weather: "Wechselhaft", area: "Rohbau", findings: ["absturz.seitenschutz", "ordnung.stolper", "psa.gehoer_augen", "notfall.plan"] },
  { site: "aargau", daysAgo: 150, inspector: "pl_tozzo", type: "routine", weather: "Kalt, 4 °C", area: "Rückbau", findings: ["staub_laerm.staub", "elektro.provisorium", "gefahrstoffe.lagerung", "instruktion.av"] },
  { site: "aargau", daysAgo: 95, inspector: "sibe", type: "ims_audit", weather: "Bewölkt", area: "Innenausbau", findings: ["elektro.provisorium", "verkehr.fluchtweg", "notfall.material", "brand.loeschmittel", "umwelt.abfall"] },
  { site: "aargau", daysAgo: 48, inspector: "pl_tozzo", type: "routine", weather: "Sonnig", area: "Haustechnik", findings: ["elektro.provisorium", "elektro.verteiler", "brand.heissarbeiten", "nachhaltigkeit.energie"] },
  { site: "aargau", daysAgo: 12, inspector: "sibe", type: "follow_up", weather: "Sonnig", area: "Innenausbau", findings: ["elektro.provisorium", "qualitaet.schutz", "ordnung.stolper", "notfall.plan"] },
  { site: "strasse", daysAgo: 160, inspector: "pl_tiefbau", type: "routine", weather: "Sonnig", area: "Leitungsbau", findings: ["graben.verbau", "organisation.signalisation", "psa.warn"] },
  { site: "strasse", daysAgo: 110, inspector: "sibe", type: "unannounced", weather: "Regen", area: "Leitungsbau", findings: ["organisation.signalisation", "graben.rand", "umwelt.gewaesser", "gefahrstoffe.lagerung"] },
  { site: "strasse", daysAgo: 62, inspector: "pl_tiefbau", type: "routine", weather: "Heiss, 31 °C", area: "Strassenbau", findings: ["organisation.signalisation", "psa.helm", "psa.warn", "umwelt.abfall"] },
  { site: "strasse", daysAgo: 20, inspector: "sibe", type: "routine", weather: "Sonnig", area: "Leitungsbau", findings: ["organisation.signalisation", "graben.verbau", "krane.anschlagmittel", "notfall.plan"] },
  { site: "strasse", daysAgo: 3, inspector: "pl_tiefbau", type: "follow_up", weather: "Bewölkt", area: "Strassenbau", findings: ["organisation.signalisation", "organisation.zutritt", "psa.warn"] },
  { site: "zuerich", daysAgo: 140, inspector: "pl_hochbau", type: "acceptance", weather: "Nebel", area: "Aushub / Baugrube", findings: ["graben.rand", "verkehr.fluchtweg", "ordnung.lager"] },
  { site: "zuerich", daysAgo: 70, inspector: "sibe", type: "routine", weather: "Sonnig", area: "Rohbau", findings: ["absturz.dach", "psa.helm", "ordnung.stolper", "krane.anschlagmittel", "instruktion.av"] },
  { site: "zuerich", daysAgo: 33, inspector: "pl_hochbau", type: "routine", weather: "Sonnig", area: "Rohbau", findings: ["absturz.seitenschutz", "elektro.provisorium", "qualitaet.ausfuehrung", "brand.loeschmittel"] },
  { site: "zuerich", daysAgo: 9, inspector: "sibe", type: "unannounced", weather: "Regen", area: "Rohbau / Dach", findings: ["absturz.dach", "psa.helm", "ordnung.stolper", "geruest.belag", "notfall.material"] },
];

// -----------------------------------------------------------------------------
// Grafiken
// -----------------------------------------------------------------------------
function logoSvg(name: string, short: string, color: string): Buffer {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="300" viewBox="0 0 900 300">
  <rect width="900" height="300" fill="#ffffff"/>
  <rect x="20" y="50" width="200" height="200" rx="24" fill="${color}"/>
  <path d="M60 210 L120 90 L180 210 Z" fill="#ffffff" opacity="0.92"/>
  <rect x="100" y="170" width="40" height="40" fill="${color}"/>
  <text x="250" y="150" font-family="Arial, Helvetica, sans-serif" font-size="58" font-weight="700" fill="#111827">${short}</text>
  <text x="250" y="210" font-family="Arial, Helvetica, sans-serif" font-size="34" fill="#374151">${name}</text>
</svg>`);
}

const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function demoPhotoSvg(title: string, variant: number, assessment: Assessment): Buffer {
  const skies = ["#9cc3e6", "#b8c6d1", "#c9d6df", "#a7c4dd"];
  const accent = assessment === "positive" ? "#15803d" : assessment === "improvement" ? "#b45309" : "#b91c1c";
  const craneX = 700 + (variant % 3) * 120;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="960" viewBox="0 0 1280 960">
  <rect width="1280" height="960" fill="${skies[variant % skies.length]}"/>
  <rect y="620" width="1280" height="340" fill="#8b7d6b"/>
  <rect x="120" y="300" width="520" height="320" fill="#bfbfbf" stroke="#6b7280" stroke-width="6"/>
  ${Array.from({ length: 4 }, (_, i) => `<rect x="${150 + i * 120}" y="340" width="80" height="80" fill="#4b5563"/>`).join("")}
  <rect x="100" y="280" width="560" height="14" fill="#f59e0b"/>
  <rect x="${craneX}" y="120" width="24" height="500" fill="#eab308"/>
  <rect x="${craneX - 300}" y="120" width="460" height="20" fill="#eab308"/>
  <line x1="${craneX - 220}" y1="140" x2="${craneX - 220}" y2="360" stroke="#1f2937" stroke-width="4"/>
  <rect x="${craneX - 250}" y="360" width="60" height="40" fill="#78350f"/>
  <rect x="0" y="0" width="1280" height="90" fill="rgba(17,24,39,0.78)"/>
  <text x="40" y="58" font-family="Arial, Helvetica, sans-serif" font-size="40" fill="#ffffff">DEMO-BILD · ${escapeXml(title.slice(0, 48))}</text>
  <rect x="40" y="820" width="360" height="90" rx="12" fill="${accent}"/>
  <text x="70" y="880" font-family="Arial, Helvetica, sans-serif" font-size="40" fill="#ffffff">Platzhalter</text>
</svg>`);
}

// -----------------------------------------------------------------------------
// Ablauf
// -----------------------------------------------------------------------------
async function resetData(tx: Tx) {
  const demoEmails = USERS.map((u) => u.email);
  await tx.unsafe(`truncate table
    public.recurring_issue_cluster_members, public.recurring_issue_clusters, public.ai_suggestions,
    public.email_deliveries, public.report_versions, public.generated_reports, public.report_counters,
    public.action_updates, public.attachments, public.corrective_actions, public.finding_references,
    public.finding_images, public.findings, public.inspection_participants, public.inspections,
    public.inspection_templates, public.report_templates, public.category_reference_mappings,
    public.legal_references, public.finding_subcategories, public.finding_categories, public.site_memberships,
    public.construction_sites, public.projects, public.company_logos, public.user_roles,
    public.notification_settings, public.system_settings, public.audit_logs cascade`);
  await tx`delete from public.user_profiles where business_email = any(${demoEmails})`;
  await tx`delete from auth.users where email = any(${demoEmails})`;
  await tx.unsafe(`delete from public.companies`);
}

async function insertAuthUser(tx: Tx, id: string, email: string, fullName: string) {
  const cols = new Set(
    (await tx<{ columnName: string }[]>`select column_name from information_schema.columns where table_schema = 'auth' and table_name = 'users'`).map((c) => c.columnName),
  );
  const values: Record<string, unknown> = {
    id,
    instance_id: "00000000-0000-0000-0000-000000000000",
    aud: "authenticated",
    role: "authenticated",
    email,
    raw_app_meta_data: { provider: "email", providers: ["email"] },
    raw_user_meta_data: { full_name: fullName },
    created_at: NOW,
    updated_at: NOW,
  };
  if (cols.has("email_confirmed_at")) values.email_confirmed_at = NOW;
  else if (cols.has("confirmed_at")) values.confirmed_at = NOW;
  const keys = Object.keys(values).filter((k) => cols.has(k));
  const params = keys.map((k) => (typeof values[k] === "object" && !(values[k] instanceof Date) ? JSON.stringify(values[k]) : values[k]));
  const placeholders = keys.map((k, i) => (k.startsWith("raw_") ? `$${i + 1}::jsonb` : `$${i + 1}`));
  await tx.unsafe(
    `insert into auth.users (${keys.join(", ")}, encrypted_password) values (${placeholders.join(", ")}, extensions.crypt($${keys.length + 1}, extensions.gen_salt('bf')))`,
    [...params, DEMO_PASSWORD] as never[],
  );
  const hasIdentities = (await tx`select 1 from information_schema.tables where table_schema = 'auth' and table_name = 'identities'`).length > 0;
  if (hasIdentities) {
    await tx.unsafe(
      `insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
       values (gen_random_uuid(), $1, $1, jsonb_build_object('sub', $1::text, 'email', $2::text), 'email', now(), now(), now())`,
      [id, email],
    );
  }
}

async function main() {
  console.log("Seed: Demo-Daten werden angelegt …");
  const ids = await withService(async (tx) => {
    await resetData(tx);

    // Einstellungen
    const settings: [string, unknown, string][] = [
      ["ai", { allowExternal: false, allowImages: false }, "KI-Verarbeitung: externe Dienste und Bildübermittlung (Standard: aus)"],
      ["images", { stripMetadata: true }, "Metadaten (inkl. GPS) von Fotos entfernen"],
      ["retention", { inspectionsYears: 10, imagesYears: 5, emailLogYears: 10, auditLogYears: 10, aiSuggestionsDays: 365 }, "Aufbewahrungsfristen"],
      ["reports", {}, "Standardtexte für Berichte"],
      ["recurrence.scoring", DEFAULT_SCORING_CONFIG, "Punktemodell wiederkehrende Abweichungen"],
    ];
    for (const [key, value, description] of settings) {
      await tx`insert into public.system_settings (key, value, description) values (${key}, ${tx.json(value as never)}, ${description})`;
    }

    // Katalog
    const refIds = new Map<string, string>();
    for (const r of SEED_REFERENCES) {
      const [row] = await tx<{ id: string }[]>`
        insert into public.legal_references (reference_type, code, title, description, source, review_status, review_note)
        values (${r.type}, ${r.code}, ${r.title}, ${r.description}, ${r.source}, 'to_review',
                'Initialer Orientierungseintrag aus der Einführung – fachliche Prüfung ausstehend.')
        returning id`;
      refIds.set(r.key, row.id);
    }
    const subIds = new Map<string, string>();
    let order = 1;
    for (const c of SEED_CATEGORIES) {
      const [cat] = await tx<{ id: string }[]>`
        insert into public.finding_categories (code, sort_order, name, description, default_risk, keywords, internal_rule, sample_action)
        values (${c.code}, ${order++}, ${c.name}, ${c.description}, ${c.defaultRisk}, ${c.keywords}, ${c.internalRule}, ${c.sampleAction})
        returning id`;
      let subOrder = 1;
      for (const s of c.subcategories) {
        const [sub] = await tx<{ id: string }[]>`
          insert into public.finding_subcategories (category_id, code, name, default_risk, keywords, sample_action, sort_order)
          values (${cat.id}, ${s.code}, ${s.name}, ${s.defaultRisk ?? null}, ${s.keywords}, ${s.sampleAction ?? null}, ${subOrder++})
          returning id`;
        subIds.set(s.code, sub.id);
      }
      for (const key of c.references) {
        await tx`insert into public.category_reference_mappings (category_id, legal_reference_id) values (${cat.id}, ${refIds.get(key)!})`;
      }
    }

    // Gesellschaften inkl. Logos
    const companyIds = new Map<CompanyKey, string>();
    for (const c of COMPANIES) {
      const [row] = await tx<{ id: string }[]>`
        insert into public.companies (name, short_code, street, postal_code, city, primary_color, email_sender_name, default_distribution,
                                      report_disclaimer, confidentiality_note)
        values (${c.name}, ${c.short}, ${c.street}, ${c.postal}, ${c.city}, ${c.color}, ${c.sender}, ${c.distribution},
                ${`Dieser Bericht dokumentiert betriebliche Kontrollfeststellungen der ${c.name} zum Zeitpunkt der Kontrolle. Er stellt keine abschliessende rechtliche oder fachliche Beurteilung dar; eine fachliche bzw. rechtliche Würdigung im Einzelfall bleibt vorbehalten. Referenzen dienen als Orientierungshilfe.`},
                ${"Vertraulich – nur für den internen Gebrauch und die genannten Empfänger."})
        returning id`;
      companyIds.set(c.key, row.id);
      const logo = await processLogo(logoSvg(c.name, c.short, c.color));
      const path = `${row.id}/logo-${randomUUID()}.png`;
      await storage().put("company-logos", path, logo.data, "image/png");
      await tx`insert into public.company_logos (company_id, storage_path, mime_type, width, height) values (${row.id}, ${path}, 'image/png', ${logo.width}, ${logo.height})`;
    }

    // Benutzer
    const userIds = new Map<UserKey, string>();
    for (const u of USERS) {
      const id = randomUUID();
      userIds.set(u.key, id);
      await insertAuthUser(tx, id, u.email, u.name);
      const defaultCompany = u.roles.find((r) => r.company)?.company ?? (u.key === "polier_birr" ? "hochbau" : "tozzo");
      await tx`insert into public.user_profiles (id, full_name, business_email, job_title, default_company_id)
               values (${id}, ${u.name}, ${u.email}, ${u.title}, ${companyIds.get(defaultCompany as CompanyKey)!})`;
      for (const r of u.roles) {
        await tx`insert into public.user_roles (user_id, role, company_id) values (${id}, ${r.role}, ${r.company ? companyIds.get(r.company)! : null})`;
      }
      await tx`insert into public.notification_settings (user_id) values (${id})`;
    }

    // Projekte und Baustellen
    const siteIds = new Map<SiteKey, string>();
    for (const s of SITES) {
      const companyId = companyIds.get(s.company)!;
      const [project] = await tx<{ id: string }[]>`
        insert into public.projects (company_id, project_number, name) values (${companyId}, ${s.project}, ${s.name}) returning id`;
      const [site] = await tx<{ id: string }[]>`
        insert into public.construction_sites (company_id, project_id, site_number, name, street, postal_code, city, canton)
        values (${companyId}, ${project.id}, ${s.number}, ${s.name}, ${s.street}, ${s.postal}, ${s.city}, ${s.canton}) returning id`;
      siteIds.set(s.key, site.id);
    }
    for (const m of MEMBERSHIPS) {
      await tx`insert into public.site_memberships (site_id, user_id, role) values (${siteIds.get(m.site)!}, ${userIds.get(m.user)!}, ${m.role})`;
    }

    // Kontrollvorlage mit häufigen Feststellungen
    const frequent = ["absturz.seitenschutz", "psa.helm", "ordnung.stolper", "elektro.provisorium", "organisation.signalisation", "geruest.belag", "oeffnungen.abdeckung", "notfall.plan"];
    const items = frequent.map((k) => {
      const t = T[k][0];
      const cat = SEED_CATEGORIES.find((c) => c.subcategories.some((s) => s.code === t.sub))!;
      return { title: t.title, category_code: cat.code, subcategory_code: t.sub, assessment: t.assessment, risk_level: t.risk, action: t.action ?? null, responsible_role: t.role ?? null };
    });
    await tx`insert into public.inspection_templates (company_id, name, description, inspection_type, items)
             values (null, 'Standard-Baustellenkontrolle', 'Häufige Feststellungen für die Schnellerfassung', 'routine', ${tx.json(items as never)})`;
    await tx`insert into public.inspection_templates (company_id, name, description, inspection_type, items)
             values (${companyIds.get("tiefbau")!}, 'Tiefbau – Gräben und Signalisation', 'Schwerpunkte Leitungs- und Strassenbau', 'routine',
                     ${tx.json([
                       { title: T["graben.verbau"][0].title, category_code: "graben", subcategory_code: "graben.verbau", assessment: "negative", risk_level: "critical", action: T["graben.verbau"][0].action, responsible_role: "Vorarbeiter Tiefbau" },
                       { title: T["organisation.signalisation"][0].title, category_code: "organisation", subcategory_code: "organisation.signalisation", assessment: "negative", risk_level: "medium", action: T["organisation.signalisation"][0].action, responsible_role: "Vorarbeiter Tiefbau" },
                       { title: T["psa.warn"][0].title, category_code: "psa", subcategory_code: "psa.warn", assessment: "positive", risk_level: null, action: null, responsible_role: null },
                     ] as never)})`;
    await tx`insert into public.report_templates (company_id, name, config, is_default) values (null, 'Standardbericht', ${tx.json({ showReferences: true, showRecurring: true } as never)}, true)`;

    return { companyIds, siteIds, userIds, subIds };
  });

  // Kontrollen und Feststellungen (inkl. Bilder)
  let findingCount = 0;
  let imageCount = 0;
  const usage = new Map<string, number>();
  await withService(async (tx) => {
    for (const plan of INSPECTIONS) {
      const siteId = ids.siteIds.get(plan.site)!;
      const inspectorId = ids.userIds.get(plan.inspector)!;
      const inspectedAt = new Date(NOW.getTime() - plan.daysAgo * DAY);
      inspectedAt.setUTCHours(7 + Math.floor(rand() * 5), [0, 15, 30, 45][Math.floor(rand() * 4)], 0, 0);
      const [insp] = await tx<{ id: string }[]>`
        insert into public.inspections (site_id, inspection_type, status, inspected_at, inspector_id, weather, area, completed_at, created_by, created_at)
        values (${siteId}, ${plan.type}, ${plan.daysAgo > 2 ? "completed" : "draft"}, ${inspectedAt}, ${inspectorId}, ${plan.weather}, ${plan.area},
                ${plan.daysAgo > 2 ? new Date(inspectedAt.getTime() + 3 * 3600_000) : null}, ${inspectorId}, ${inspectedAt})
        returning id`;
      const siteDef = SITES.find((s) => s.key === plan.site)!;
      const participants = [
        { name: siteDef.company === "tiefbau" ? "Luca Rossi" : "Sandra Meier", fn: "Projektleitung" },
        { name: plan.site === "birr" ? "Beat Huber" : pick(["Stefan Graf", "Reto Brunner", "Daniel Steiner"]), fn: "Polier" },
      ];
      for (const p of participants) {
        await tx`insert into public.inspection_participants (inspection_id, full_name, function_label, created_by) values (${insp.id}, ${p.name}, ${p.fn}, ${inspectorId})`;
      }

      for (let i = 0; i < plan.findings.length; i++) {
        const key = plan.findings[i];
        const variants = T[key];
        const n = usage.get(key) ?? 0;
        usage.set(key, n + 1);
        const t = variants[n % variants.length];
        const createdAt = new Date(inspectedAt.getTime() + (i + 1) * 7 * 60_000);
        const subId = ids.subIds.get(t.sub)!;
        const [finding] = await tx<{ id: string }[]>`
          insert into public.findings (inspection_id, title, description, assessment, subcategory_id, risk_level, trade, location,
                                       responsible_role, created_by, created_at)
          values (${insp.id}, ${t.title}, ${t.description}, ${t.assessment}, ${subId}, ${t.risk}, ${t.trade}, ${t.location ?? null},
                  ${t.role ?? null}, ${inspectorId}, ${createdAt})
          returning id`;
        findingCount++;

        // Referenzen der Kategorie übernehmen (Orientierung)
        await tx`insert into public.finding_references (finding_id, legal_reference_id, created_by)
                 select ${finding.id}, m.legal_reference_id, ${inspectorId}
                 from public.category_reference_mappings m join public.finding_subcategories s on s.category_id = m.category_id
                 where s.id = ${subId} limit 2`;

        if (t.assessment !== "positive" && t.action) {
          const dueDays = t.risk === "critical" ? 2 : t.risk === "high" ? 7 : t.risk === "medium" ? 14 : 30;
          const due = new Date(inspectedAt.getTime() + dueDays * DAY);
          const age = plan.daysAgo;
          let status: ActionStatus;
          const r = rand();
          if (age > 60) status = r < 0.8 ? "closed" : r < 0.9 ? "verified" : "open";
          else if (age > 20) status = r < 0.35 ? "closed" : r < 0.55 ? "resolved" : r < 0.75 ? "in_progress" : "open";
          else status = r < 0.25 ? "resolved" : r < 0.55 ? "in_progress" : "open";
          const late = rand() < 0.35;
          const completedAt = ["resolved", "verified", "closed"].includes(status)
            ? new Date(Math.min(NOW.getTime() - DAY, due.getTime() + (late ? 6 : -1) * DAY))
            : null;
          const verified = status === "verified" || status === "closed";
          const verifier = ids.userIds.get(plan.inspector)!;
          await tx`
            insert into public.corrective_actions (finding_id, description, responsible_role, responsible_person, due_date, status,
              completed_at, completion_note, verified_at, verified_by, verification_note, created_by, created_at)
            values (${finding.id}, ${t.action}, ${t.role ?? null}, ${t.role === "Polier" && plan.site === "birr" ? "Beat Huber" : null},
                    ${due.toISOString().slice(0, 10)}, ${status}, ${completedAt},
                    ${completedAt ? "Massnahme umgesetzt, Foto im Baustellenordner." : null},
                    ${verified ? new Date(completedAt!.getTime() + DAY) : null}, ${verified ? verifier : null},
                    ${verified ? "Umsetzung vor Ort kontrolliert und wirksam." : null}, ${inspectorId}, ${createdAt})`;
        }

        // Bilder: bei Abweichungen meist, bei positiven teilweise
        const imageNumber = t.assessment === "negative" ? (rand() < 0.75 ? 1 + Math.floor(rand() * 2) : 0) : rand() < 0.4 ? 1 : 0;
        for (let k = 0; k < imageNumber; k++) {
          const jpg = await sharp(demoPhotoSvg(t.title, findingCount + k, t.assessment)).jpeg({ quality: 82 }).toBuffer();
          const processed = await processPhoto(jpg, { stripMetadata: true });
          const siteDef2 = SITES.find((s) => s.key === plan.site)!;
          const companyId = ids.companyIds.get(siteDef2.company)!;
          const imgId = randomUUID();
          const path = `${companyId}/${siteId}/${finding.id}/${imgId}.jpg`;
          const thumb = `${companyId}/${siteId}/${finding.id}/${imgId}-thumb.jpg`;
          await storage().put("finding-images", path, processed.data, "image/jpeg");
          await storage().put("finding-images", thumb, processed.thumbnail, "image/jpeg");
          await tx`insert into public.finding_images (id, finding_id, storage_path, thumbnail_path, caption, mime_type, width, height, size_bytes, sort_order, created_by, created_at)
                   values (${imgId}, ${finding.id}, ${path}, ${thumb}, ${k === 0 ? `Situation vor Ort: ${t.title}` : "Detailansicht"}, 'image/jpeg',
                           ${processed.width}, ${processed.height}, ${processed.data.byteLength}, ${k}, ${inspectorId}, ${createdAt})`;
          imageCount++;
        }
      }
    }
    await tx`delete from public.audit_logs`;
    await tx`insert into public.audit_logs (entity_type, entity_id, action, context) values ('system', 'seed', 'seed', ${tx.json({ inspections: INSPECTIONS.length, findings: findingCount } as never)})`;
  });

  const { clusters } = await recomputeRecurringClusters();
  console.log(`✓ ${COMPANIES.length} Gesellschaften, ${SITES.length} Baustellen, ${USERS.length} Benutzer`);
  console.log(`✓ ${INSPECTIONS.length} Kontrollen, ${findingCount} Feststellungen, ${imageCount} Demo-Bilder`);
  console.log(`✓ ${clusters} Cluster wiederkehrender Abweichungen`);
  console.log(`\nDemo-Zugänge (Passwort: ${DEMO_PASSWORD}):`);
  for (const u of USERS) console.log(`  ${u.email.padEnd(32)} ${u.title}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
