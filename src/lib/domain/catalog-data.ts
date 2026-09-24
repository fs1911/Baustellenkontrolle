/**
 * Initialer Kategorien- und Referenzkatalog (Seed).
 *
 * WICHTIG: Alle Referenzen sind Orientierungseinträge mit Status "zu prüfen". Es werden bewusst
 * keine Artikelnummern, Dokumentnummern oder Links behauptet, die nicht verifiziert wurden.
 * Die Inhalte müssen durch das IMS-/SIBE-Team fachlich geprüft, ergänzt und freigegeben werden
 * (siehe docs/reference-catalog-governance.md).
 */
import type { ReferenceType, RiskLevel } from "./enums";

export interface SeedSubcategory {
  code: string;
  name: string;
  keywords: string[];
  defaultRisk?: RiskLevel;
  sampleAction?: string;
}

export interface SeedCategory {
  code: string;
  name: string;
  description: string;
  defaultRisk: RiskLevel;
  keywords: string[];
  internalRule: string;
  sampleAction: string;
  references: string[]; // Keys aus SEED_REFERENCES
  subcategories: SeedSubcategory[];
}

export interface SeedReference {
  key: string;
  type: ReferenceType;
  code: string;
  title: string;
  description: string;
  source: string;
}

const REVIEW_NOTE =
  "Orientierungseintrag – Fundstelle, Artikel/Kapitel, Version und Link sind durch das IMS-/SIBE-Team zu prüfen und zu ergänzen.";

export const SEED_REFERENCES: SeedReference[] = [
  { key: "bauav", type: "bauav", code: "BauAV (SR 832.311.141)", title: "Bauarbeitenverordnung – allgemeine Bestimmungen", description: `Verordnung über die Sicherheit und den Gesundheitsschutz der Arbeitnehmerinnen und Arbeitnehmer bei Bauarbeiten. ${REVIEW_NOTE}`, source: "fedlex.admin.ch" },
  { key: "bauav_absturz", type: "bauav", code: "BauAV – Absturzsicherung", title: "Schutzmassnahmen gegen Absturz (Abschnitt zu prüfen)", description: `Bestimmungen zu Absturzkanten, Seitenschutz und Öffnungen. ${REVIEW_NOTE}`, source: "fedlex.admin.ch" },
  { key: "bauav_geruest", type: "bauav", code: "BauAV – Gerüste", title: "Bestimmungen zu Gerüsten (Abschnitt zu prüfen)", description: `Anforderungen an Erstellung, Kontrolle und Benützung von Gerüsten. ${REVIEW_NOTE}`, source: "fedlex.admin.ch" },
  { key: "bauav_graben", type: "bauav", code: "BauAV – Gräben, Schächte, Baugruben", title: "Bestimmungen zu Gräben und Baugruben (Abschnitt zu prüfen)", description: `Sicherung von Gräben, Baugruben und Böschungen. ${REVIEW_NOTE}`, source: "fedlex.admin.ch" },
  { key: "bauav_verkehr", type: "bauav", code: "BauAV – Verkehrswege", title: "Verkehrswege und Zugänge auf Baustellen (Abschnitt zu prüfen)", description: REVIEW_NOTE, source: "fedlex.admin.ch" },
  { key: "vuv", type: "vuv", code: "VUV (SR 832.30)", title: "Verordnung über die Verhütung von Unfällen und Berufskrankheiten", description: `Allgemeine Pflichten des Arbeitgebers, u. a. PSA, Information und Anleitung, Arbeitsmittel. ${REVIEW_NOTE}`, source: "fedlex.admin.ch" },
  { key: "vuv_psa", type: "vuv", code: "VUV – Persönliche Schutzausrüstung", title: "Pflichten zu persönlichen Schutzausrüstungen (Artikel zu prüfen)", description: REVIEW_NOTE, source: "fedlex.admin.ch" },
  { key: "vuv_info", type: "vuv", code: "VUV – Information und Anleitung", title: "Information und Anleitung der Arbeitnehmenden (Artikel zu prüfen)", description: REVIEW_NOTE, source: "fedlex.admin.ch" },
  { key: "vuv_arbeitsmittel", type: "vuv", code: "VUV – Arbeitsmittel", title: "Anforderungen an Arbeitsmittel (Artikel zu prüfen)", description: REVIEW_NOTE, source: "fedlex.admin.ch" },
  { key: "argv3", type: "argv", code: "ArGV 3 (SR 822.113)", title: "Verordnung 3 zum Arbeitsgesetz – Gesundheitsschutz", description: REVIEW_NOTE, source: "fedlex.admin.ch" },
  { key: "ekas_6508", type: "ekas", code: "EKAS-Richtlinie 6508", title: "Beizug von Arbeitsärzten und anderen Spezialisten der Arbeitssicherheit (ASA)", description: `Organisation der Arbeitssicherheit im Betrieb. ${REVIEW_NOTE}`, source: "ekas.ch" },
  { key: "ekas_6512", type: "ekas", code: "EKAS-Richtlinie 6512", title: "Arbeitsmittel", description: REVIEW_NOTE, source: "ekas.ch" },
  { key: "suva_lr_bau", type: "suva_vital_rule", code: "Suva – Lebenswichtige Regeln Bau", title: "Lebenswichtige Regeln für das Bauhauptgewerbe / Gebäudehülle (Publikation und Regel zu prüfen)", description: REVIEW_NOTE, source: "suva.ch" },
  { key: "suva_cl_leitern", type: "suva_checklist", code: "Suva-Checkliste Leitern", title: "Checkliste zu tragbaren Leitern (Nummer zu prüfen)", description: REVIEW_NOTE, source: "suva.ch" },
  { key: "suva_cl_geruest", type: "suva_checklist", code: "Suva-Checkliste Fassadengerüste", title: "Checkliste Fassadengerüste (Nummer zu prüfen)", description: REVIEW_NOTE, source: "suva.ch" },
  { key: "suva_cl_elektro", type: "suva_checklist", code: "Suva-Checkliste Elektrische Installationen auf Baustellen", title: "Checkliste Baustromverteiler und Provisorien (Nummer zu prüfen)", description: REVIEW_NOTE, source: "suva.ch" },
  { key: "suva_cl_psa", type: "suva_checklist", code: "Suva-Checkliste PSA", title: "Checkliste Persönliche Schutzausrüstung (Nummer zu prüfen)", description: REVIEW_NOTE, source: "suva.ch" },
  { key: "suva_cl_graben", type: "suva_checklist", code: "Suva-Checkliste Gräben und Baugruben", title: "Checkliste Gräben und Baugruben (Nummer zu prüfen)", description: REVIEW_NOTE, source: "suva.ch" },
  { key: "suva_cl_anschlag", type: "suva_checklist", code: "Suva-Checkliste Anschlagmittel", title: "Checkliste Anschlagen von Lasten (Nummer zu prüfen)", description: REVIEW_NOTE, source: "suva.ch" },
  { key: "suva_staub", type: "suva_checklist", code: "Suva – Quarzstaub / Staub auf Baustellen", title: "Informationen und Checklisten zu Staubschutz (Publikation zu prüfen)", description: REVIEW_NOTE, source: "suva.ch" },
  { key: "suva_laerm", type: "suva_checklist", code: "Suva – Lärm und Gehörschutz", title: "Informationen zu Lärm am Arbeitsplatz (Publikation zu prüfen)", description: REVIEW_NOTE, source: "suva.ch" },
  { key: "kranv", type: "other", code: "Kranverordnung (SR 832.312.15)", title: "Verordnung über die sichere Verwendung von Kranen", description: REVIEW_NOTE, source: "fedlex.admin.ch" },
  { key: "niv", type: "other", code: "NIV (SR 734.27)", title: "Niederspannungs-Installationsverordnung", description: REVIEW_NOTE, source: "fedlex.admin.ch" },
  { key: "chemv", type: "other", code: "ChemV (SR 813.11)", title: "Chemikalienverordnung", description: REVIEW_NOTE, source: "fedlex.admin.ch" },
  { key: "vkf", type: "other", code: "VKF-Brandschutzvorschriften", title: "Brandschutznorm und -richtlinien der VKF (Richtlinie zu prüfen)", description: REVIEW_NOTE, source: "vkg.ch / bsvonline.ch" },
  { key: "gschg", type: "other", code: "GSchG (SR 814.20)", title: "Gewässerschutzgesetz", description: REVIEW_NOTE, source: "fedlex.admin.ch" },
  { key: "vvea", type: "other", code: "VVEA (SR 814.600)", title: "Verordnung über die Vermeidung und die Entsorgung von Abfällen", description: REVIEW_NOTE, source: "fedlex.admin.ch" },
  { key: "lrv", type: "other", code: "LRV (SR 814.318.142.1)", title: "Luftreinhalte-Verordnung (Baustellen: BAFU-Richtlinie Luftreinhaltung auf Baustellen)", description: REVIEW_NOTE, source: "fedlex.admin.ch / bafu.admin.ch" },
  { key: "sia118", type: "sia", code: "SIA 118", title: "Allgemeine Bedingungen für Bauarbeiten (Mängel, Abnahme)", description: REVIEW_NOTE, source: "sia.ch" },
  { key: "iso45001_812", type: "iso_45001", code: "ISO 45001:2018, 8.1.2", title: "Beseitigung von Gefahren und Minimierung von SGA-Risiken", description: "Orientierung für die Rangfolge von Schutzmassnahmen (STOP-Prinzip).", source: "ISO" },
  { key: "iso45001_72", type: "iso_45001", code: "ISO 45001:2018, 7.2", title: "Kompetenz", description: "Qualifikation und Instruktion der Mitarbeitenden.", source: "ISO" },
  { key: "iso45001_82", type: "iso_45001", code: "ISO 45001:2018, 8.2", title: "Notfallvorsorge und Gefahrenabwehr", description: "Notfallorganisation, Erste Hilfe, Übungen.", source: "ISO" },
  { key: "iso45001_102", type: "iso_45001", code: "ISO 45001:2018, 10.2", title: "Vorfälle, Nichtkonformitäten und Korrekturmassnahmen", description: "Ursachenanalyse und Wirksamkeitsprüfung von Korrekturmassnahmen.", source: "ISO" },
  { key: "iso9001_85", type: "iso_9001", code: "ISO 9001:2015, 8.5", title: "Produktion und Dienstleistungserbringung", description: "Beherrschte Bedingungen bei der Ausführung.", source: "ISO" },
  { key: "iso9001_102", type: "iso_9001", code: "ISO 9001:2015, 10.2", title: "Nichtkonformität und Korrekturmassnahmen", description: "Umgang mit Mängeln und Wirksamkeitsprüfung.", source: "ISO" },
  { key: "iso14001_81", type: "iso_14001", code: "ISO 14001:2015, 8.1", title: "Betriebliche Planung und Steuerung", description: "Umweltaspekte auf der Baustelle (Abfall, Gewässer, Emissionen).", source: "ISO" },
  { key: "iso14001_82", type: "iso_14001", code: "ISO 14001:2015, 8.2", title: "Notfallvorsorge und Gefahrenabwehr", description: "Umweltnotfälle, z. B. Ölaustritt.", source: "ISO" },
  { key: "int_sibe", type: "internal", code: "Interne Weisung Arbeitssicherheit", title: "tozzo gruppe – Weisung Arbeitssicherheit auf Baustellen (Platzhalter)", description: "Platzhalter für die interne Weisung. Dokument und Version durch IMS ergänzen.", source: "IMS tozzo gruppe" },
  { key: "int_ordnung", type: "internal", code: "Interne Weisung Baustellenordnung", title: "Baustellenordnung und Logistik (Platzhalter)", description: "Platzhalter für die interne Weisung. Dokument und Version durch IMS ergänzen.", source: "IMS tozzo gruppe" },
];

export const SEED_CATEGORIES: SeedCategory[] = [
  {
    code: "absturz", name: "Absturzsicherheit", defaultRisk: "high",
    description: "Sicherung gegen Absturz an Kanten, auf Dächern und bei erhöhten Arbeitsplätzen.",
    keywords: ["absturz", "absturzsicherung", "seitenschutz", "geländer", "dachrand", "auffanggurt", "anseilschutz", "kante", "randabsturz", "fangnetz", "dach", "attika", "sicherheitsnetz"],
    internalRule: "Weisung Arbeitssicherheit, Kapitel Absturzsicherung (Platzhalter)",
    sampleAction: "Absturzkante sofort mit dreiteiligem Seitenschutz sichern; bis dahin Bereich sperren.",
    references: ["bauav_absturz", "suva_lr_bau", "iso45001_812"],
    subcategories: [
      { code: "absturz.seitenschutz", name: "Seitenschutz fehlend oder mangelhaft", keywords: ["seitenschutz", "geländer", "knieleiste", "bordbrett", "zwischenholm", "handlauf"], defaultRisk: "high", sampleAction: "Seitenschutz (Geländerholm, Zwischenholm, Bordbrett) vollständig montieren." },
      { code: "absturz.dach", name: "Arbeiten auf Dächern", keywords: ["dach", "dachrand", "dachfläche", "lichtkuppel", "oblicht", "flachdach"], defaultRisk: "critical", sampleAction: "Dachrandschutz bzw. Fangnetz erstellen, Lichtkuppeln durchbruchsicher abdecken." },
      { code: "absturz.psaga", name: "PSA gegen Absturz", keywords: ["auffanggurt", "anschlagpunkt", "anseilschutz", "höhensicherungsgerät", "psaga"], defaultRisk: "high", sampleAction: "Geeignete Anschlagpunkte festlegen, PSAgA-Instruktion durchführen und dokumentieren." },
    ],
  },
  {
    code: "geruest", name: "Gerüste", defaultRisk: "high",
    description: "Fassaden-, Arbeits- und Schutzgerüste inklusive Zugänge und Verankerung.",
    keywords: ["gerüst", "fassadengerüst", "gerüstbelag", "gerüstlage", "verankerung", "gerüstfreigabe", "konsole", "fahrgerüst", "rollgerüst"],
    internalRule: "Weisung Gerüste, Freigabe durch Gerüstbauer (Platzhalter)",
    sampleAction: "Gerüst durch Gerüstbauer kontrollieren und freigeben lassen; Mängel vor Weiterbenützung beheben.",
    references: ["bauav_geruest", "suva_cl_geruest", "iso45001_812"],
    subcategories: [
      { code: "geruest.belag", name: "Gerüstbelag unvollständig", keywords: ["belag", "gerüstbelag", "lücke", "bretter", "belagsteil"], defaultRisk: "high", sampleAction: "Gerüstbelag lückenlos schliessen; fehlende Belagsteile ersetzen." },
      { code: "geruest.abstand", name: "Wandabstand / Innengeländer", keywords: ["wandabstand", "innengeländer", "abstand fassade", "konsole"], defaultRisk: "high", sampleAction: "Wandabstand reduzieren oder Innenseitenschutz montieren." },
      { code: "geruest.freigabe", name: "Gerüstfreigabe / Kennzeichnung", keywords: ["freigabe", "gerüstkarte", "kennzeichnung", "abnahme gerüst", "umbau"], defaultRisk: "medium", sampleAction: "Gerüstfreigabe einholen und am Zugang sichtbar anbringen." },
      { code: "geruest.fahrgeruest", name: "Fahr- und Rollgerüste", keywords: ["fahrgerüst", "rollgerüst", "bremse", "ausleger"], defaultRisk: "medium", sampleAction: "Rollen feststellen, Ausleger montieren, Aufbauanleitung beachten." },
    ],
  },
  {
    code: "leitern", name: "Leitern und Aufstiege", defaultRisk: "medium",
    description: "Tragbare Leitern, Treppentürme und Zugänge zu Arbeitsplätzen.",
    keywords: ["leiter", "anstellleiter", "bockleiter", "stehleiter", "treppenturm", "aufstieg", "sprosse", "zugang"],
    internalRule: "Weisung Arbeitsmittel, Kapitel Leitern (Platzhalter)",
    sampleAction: "Defekte Leitern ausser Betrieb nehmen; sicheren Aufstieg (Treppenturm) bereitstellen.",
    references: ["suva_cl_leitern", "vuv_arbeitsmittel", "ekas_6512"],
    subcategories: [
      { code: "leitern.zustand", name: "Leiter defekt oder ungeeignet", keywords: ["defekt", "sprosse", "beschädigt", "ungeeignet", "selbstgebaut"], defaultRisk: "medium", sampleAction: "Leiter kennzeichnen und entfernen; geprüfte Leiter einsetzen." },
      { code: "leitern.aufstellung", name: "Leiter falsch aufgestellt / nicht gesichert", keywords: ["aufgestellt", "überstand", "gesichert", "rutschen", "anstellwinkel"], defaultRisk: "medium", sampleAction: "Leiter gegen Wegrutschen sichern, 1 m Überstand sicherstellen." },
    ],
  },
  {
    code: "oeffnungen", name: "Öffnungen, Bodenöffnungen und Absturzkanten", defaultRisk: "high",
    description: "Boden-, Wand- und Deckenöffnungen, Schächte und Aussparungen.",
    keywords: ["öffnung", "bodenöffnung", "aussparung", "deckenöffnung", "liftschacht", "schacht", "abdeckung", "durchbruch", "treppenauge"],
    internalRule: "Weisung Arbeitssicherheit, Öffnungen (Platzhalter)",
    sampleAction: "Öffnung durchbruchsicher und unverschiebbar abdecken und kennzeichnen.",
    references: ["bauav_absturz", "suva_lr_bau"],
    subcategories: [
      { code: "oeffnungen.abdeckung", name: "Abdeckung fehlt oder nicht fixiert", keywords: ["abdeckung", "nicht fixiert", "verschiebbar", "fehlt", "aussparung"], defaultRisk: "high", sampleAction: "Abdeckung tragfähig ausführen, fixieren und beschriften." },
      { code: "oeffnungen.schacht", name: "Lift- und Installationsschächte", keywords: ["liftschacht", "schacht", "installationsschacht", "steigzone"], defaultRisk: "critical", sampleAction: "Schachtöffnung mit Seitenschutz oder Abschrankung sichern." },
    ],
  },
  {
    code: "psa", name: "Persönliche Schutzausrüstung", defaultRisk: "medium",
    description: "Tragen und Zustand von Helm, Schuhen, Warnkleidung, Gehör-, Augen- und Handschutz.",
    keywords: ["psa", "helm", "schutzhelm", "sicherheitsschuhe", "warnweste", "warnkleidung", "gehörschutz", "schutzbrille", "handschuhe", "atemschutz", "ohne helm"],
    internalRule: "Weisung PSA (Platzhalter)",
    sampleAction: "Mitarbeitende direkt ansprechen, PSA-Tragpflicht in Toolbox-Meeting wiederholen.",
    references: ["vuv_psa", "suva_cl_psa", "suva_lr_bau"],
    subcategories: [
      { code: "psa.helm", name: "Schutzhelm nicht getragen", keywords: ["helm", "schutzhelm", "ohne helm", "kopfschutz"], defaultRisk: "medium", sampleAction: "Helmtragpflicht durchsetzen; Ersatzhelme bereitstellen." },
      { code: "psa.gehoer_augen", name: "Gehör- und Augenschutz", keywords: ["gehörschutz", "schutzbrille", "augenschutz", "lärm"], defaultRisk: "medium", sampleAction: "Gehör- und Augenschutz bei lärmigen/spanenden Arbeiten abgeben und tragen." },
      { code: "psa.warn", name: "Warnkleidung / Sicherheitsschuhe", keywords: ["warnweste", "warnkleidung", "sicherheitsschuhe", "turnschuhe"], defaultRisk: "low", sampleAction: "Warnkleidung und Sicherheitsschuhe einfordern." },
    ],
  },
  {
    code: "maschinen", name: "Maschinen, Geräte und Werkzeuge", defaultRisk: "medium",
    description: "Zustand, Schutzeinrichtungen und Bedienung von Maschinen und Werkzeugen.",
    keywords: ["maschine", "gerät", "werkzeug", "kreissäge", "schutzhaube", "winkelschleifer", "trennscheibe", "bagger", "hubarbeitsbühne", "stapler", "rüttelplatte"],
    internalRule: "Weisung Arbeitsmittel (Platzhalter)",
    sampleAction: "Gerät ausser Betrieb nehmen, Schutzeinrichtung instand stellen, Bedienpersonal instruieren.",
    references: ["vuv_arbeitsmittel", "ekas_6512"],
    subcategories: [
      { code: "maschinen.schutz", name: "Schutzeinrichtung fehlt / manipuliert", keywords: ["schutzhaube", "schutzeinrichtung", "manipuliert", "demontiert", "spaltkeil"], defaultRisk: "high", sampleAction: "Schutzeinrichtung wieder montieren; Manipulation unterbinden." },
      { code: "maschinen.zustand", name: "Zustand / Prüfung von Geräten", keywords: ["prüfung", "defekt", "wartung", "kabel beschädigt", "service"], defaultRisk: "medium", sampleAction: "Gerät prüfen lassen, Prüfnachweis ablegen." },
      { code: "maschinen.baumaschinen", name: "Baumaschinen und Hubarbeitsbühnen", keywords: ["bagger", "hubarbeitsbühne", "stapler", "dumper", "rückwärtsfahren"], defaultRisk: "high", sampleAction: "Einweiser stellen, Gefahrenbereich absperren, Ausweis Bedienpersonal prüfen." },
    ],
  },
  {
    code: "elektro", name: "Elektrische Anlagen und Provisorien", defaultRisk: "high",
    description: "Baustromverteiler, Kabel, Provisorien und Fehlerstromschutz.",
    keywords: ["elektro", "strom", "baustromverteiler", "kabel", "provisorium", "fi", "fehlerstrom", "verlängerungskabel", "kabelrolle", "steckdose", "leuchte", "elektrisch"],
    internalRule: "Weisung Elektrische Provisorien (Platzhalter)",
    sampleAction: "Provisorium durch Elektrofachperson prüfen und instand stellen lassen; beschädigte Kabel sofort entfernen.",
    references: ["niv", "suva_cl_elektro", "vuv_arbeitsmittel"],
    subcategories: [
      { code: "elektro.kabel", name: "Beschädigte oder ungeschützte Kabel", keywords: ["kabel", "beschädigt", "isolation", "quetschung", "kabelführung", "im wasser"], defaultRisk: "high", sampleAction: "Beschädigte Kabel ersetzen, Kabel hochgeführt und geschützt verlegen." },
      { code: "elektro.verteiler", name: "Baustromverteiler / FI-Schutz", keywords: ["baustromverteiler", "verteiler", "fi", "fehlerstrom", "offen", "abdeckung verteiler"], defaultRisk: "critical", sampleAction: "Verteiler schliessen, FI-Schutz prüfen lassen." },
      { code: "elektro.provisorium", name: "Provisorische Installationen", keywords: ["provisorium", "provisorisch", "beleuchtung", "kabelrolle", "mehrfachstecker"], defaultRisk: "high", sampleAction: "Provisorium fachgerecht erstellen lassen; Kabelrollen ganz abwickeln." },
    ],
  },
  {
    code: "krane", name: "Krane, Hebemittel und Lastentransport", defaultRisk: "high",
    description: "Kranbetrieb, Anschlagmittel und Transport von Lasten.",
    keywords: ["kran", "turmdrehkran", "autokran", "anschlagmittel", "hebeband", "kette", "last", "schwebende last", "kranführer", "anschläger"],
    internalRule: "Weisung Kranbetrieb (Platzhalter)",
    sampleAction: "Anschlagmittel prüfen und ablegereife Mittel entfernen; Aufenthalt unter schwebender Last unterbinden.",
    references: ["kranv", "suva_cl_anschlag", "suva_lr_bau"],
    subcategories: [
      { code: "krane.anschlagmittel", name: "Anschlagmittel mangelhaft", keywords: ["anschlagmittel", "hebeband", "kette", "ablegereif", "etikette"], defaultRisk: "high", sampleAction: "Ablegereife Anschlagmittel entsorgen; Prüfung dokumentieren." },
      { code: "krane.last", name: "Aufenthalt unter schwebender Last", keywords: ["schwebende last", "unter last", "lastbereich"], defaultRisk: "critical", sampleAction: "Lastbereich absperren; Kranführer und Anschläger instruieren." },
    ],
  },
  {
    code: "verkehr", name: "Verkehrswege, Zufahrten und Baustellenlogistik", defaultRisk: "medium",
    description: "Verkehrswege, Fluchtwege, Zufahrten, Trennung von Fussgängern und Fahrzeugen.",
    keywords: ["verkehrsweg", "zufahrt", "fluchtweg", "fussweg", "zugang", "logistik", "anlieferung", "rampe", "baustellenverkehr", "trennung"],
    internalRule: "Weisung Baustellenlogistik (Platzhalter)",
    sampleAction: "Verkehrswege freiräumen, markieren und Fussgänger vom Fahrverkehr trennen.",
    references: ["bauav_verkehr", "int_ordnung"],
    subcategories: [
      { code: "verkehr.fluchtweg", name: "Flucht- und Verkehrswege verstellt", keywords: ["fluchtweg", "verstellt", "blockiert", "durchgang"], defaultRisk: "medium", sampleAction: "Fluchtwege freihalten und signalisieren." },
      { code: "verkehr.trennung", name: "Trennung Fahrzeuge / Fussgänger", keywords: ["trennung", "fussgänger", "fahrzeuge", "rückwärts", "einweiser"], defaultRisk: "high", sampleAction: "Fussgängerführung abtrennen und signalisieren." },
    ],
  },
  {
    code: "ordnung", name: "Ordnung, Sauberkeit und Lagerung", defaultRisk: "low",
    description: "Ordnung auf der Baustelle, Stolperstellen, Materiallagerung.",
    keywords: ["ordnung", "sauberkeit", "unordnung", "stolperstelle", "stolpergefahr", "lagerung", "material", "abfall herumliegend", "herumliegend", "nägel", "aufräumen"],
    internalRule: "Weisung Baustellenordnung (Platzhalter)",
    sampleAction: "Arbeitsbereich aufräumen, Material geordnet lagern, tägliche Aufräumzeit festlegen.",
    references: ["int_ordnung", "bauav"],
    subcategories: [
      { code: "ordnung.stolper", name: "Stolperstellen / Unordnung", keywords: ["stolper", "unordnung", "herumliegend", "kabelsalat", "schutt"], defaultRisk: "low", sampleAction: "Stolperstellen beseitigen; Aufräumen täglich einplanen." },
      { code: "ordnung.lager", name: "Materiallagerung", keywords: ["lagerung", "gestapelt", "kippen", "material", "palette"], defaultRisk: "medium", sampleAction: "Material standsicher und geordnet lagern; Lagerplätze bezeichnen." },
    ],
  },
  {
    code: "graben", name: "Baugruben, Gräben und Böschungen", defaultRisk: "high",
    description: "Sicherung von Gräben und Baugruben, Böschungswinkel, Spriessung, Zugänge.",
    keywords: ["baugrube", "graben", "böschung", "spriessung", "grabenverbau", "verschalung", "einsturz", "grabenrand", "aushub"],
    internalRule: "Weisung Tiefbau, Gräben (Platzhalter)",
    sampleAction: "Graben verbauen bzw. Böschung abflachen; Aushub vom Grabenrand fernhalten.",
    references: ["bauav_graben", "suva_cl_graben"],
    subcategories: [
      { code: "graben.verbau", name: "Verbau / Böschung ungenügend", keywords: ["verbau", "spriessung", "böschung", "steil", "ungesichert"], defaultRisk: "critical", sampleAction: "Grabenverbau erstellen oder Böschung gemäss Bodenverhältnissen abflachen." },
      { code: "graben.rand", name: "Grabenrand / Zugang", keywords: ["grabenrand", "aushub", "zugang", "leiter graben", "absturz graben"], defaultRisk: "high", sampleAction: "Grabenrand freihalten, Zugang mit Leiter sicherstellen, Absturzsicherung erstellen." },
    ],
  },
  {
    code: "gefahrstoffe", name: "Gefahrstoffe, Chemikalien und Lagerung", defaultRisk: "medium",
    description: "Kennzeichnung, Lagerung und Umgang mit Gefahrstoffen; Sicherheitsdatenblätter.",
    keywords: ["gefahrstoff", "chemikalie", "sicherheitsdatenblatt", "lösungsmittel", "kennzeichnung", "kanister", "asbest", "pcb", "farbe", "kleber", "diesel"],
    internalRule: "Weisung Gefahrstoffe (Platzhalter)",
    sampleAction: "Gefahrstoffe gekennzeichnet in Auffangwanne lagern; Sicherheitsdatenblätter verfügbar halten.",
    references: ["chemv", "vuv", "iso14001_81"],
    subcategories: [
      { code: "gefahrstoffe.lagerung", name: "Lagerung / Auffangwanne", keywords: ["lagerung", "auffangwanne", "kanister", "offen"], defaultRisk: "medium", sampleAction: "Lagerung in Auffangwanne, Gebinde verschliessen." },
      { code: "gefahrstoffe.sdb", name: "Kennzeichnung / Sicherheitsdatenblatt", keywords: ["sicherheitsdatenblatt", "kennzeichnung", "etikette", "umgefüllt"], defaultRisk: "medium", sampleAction: "Gebinde kennzeichnen, Sicherheitsdatenblätter auf der Baustelle ablegen." },
      { code: "gefahrstoffe.schadstoff", name: "Schadstoffe im Bestand (z. B. Asbest)", keywords: ["asbest", "pcb", "schadstoff", "verdacht", "gebäudecheck"], defaultRisk: "critical", sampleAction: "Arbeiten stoppen, Schadstoffermittlung durch Fachperson veranlassen." },
    ],
  },
  {
    code: "staub_laerm", name: "Staub, Lärm und Vibrationen", defaultRisk: "medium",
    description: "Staubbelastung (insb. Quarzstaub), Lärm- und Vibrationsexposition.",
    keywords: ["staub", "quarzstaub", "lärm", "vibration", "absaugung", "spitzen", "trennen", "fräsen", "schleifen", "nass arbeiten"],
    internalRule: "Weisung Gesundheitsschutz (Platzhalter)",
    sampleAction: "Staubarme Verfahren (Absaugung, Nassbearbeitung) einsetzen; Atem- und Gehörschutz bereitstellen.",
    references: ["suva_staub", "suva_laerm", "argv3", "lrv"],
    subcategories: [
      { code: "staub_laerm.staub", name: "Staubentwicklung", keywords: ["staub", "quarzstaub", "absaugung", "staubentwicklung"], defaultRisk: "medium", sampleAction: "Absaugung bzw. Nassverfahren einsetzen, FFP-Masken abgeben." },
      { code: "staub_laerm.laerm", name: "Lärm / Vibrationen", keywords: ["lärm", "vibration", "presslufthammer", "abbruchhammer"], defaultRisk: "medium", sampleAction: "Gehörschutz abgeben, Einsatzzeiten begrenzen." },
    ],
  },
  {
    code: "brand", name: "Brand- und Explosionsschutz", defaultRisk: "high",
    description: "Löschmittel, Heissarbeiten, Lagerung brennbarer Stoffe und Gasflaschen.",
    keywords: ["brand", "feuer", "feuerlöscher", "löschmittel", "heissarbeiten", "schweissen", "gasflasche", "propan", "brennbar", "explosion", "funken"],
    internalRule: "Weisung Heissarbeiten / Brandschutz (Platzhalter)",
    sampleAction: "Löschmittel bereitstellen, Heissarbeitsbewilligung einführen, Gasflaschen gesichert lagern.",
    references: ["vkf", "vuv"],
    subcategories: [
      { code: "brand.loeschmittel", name: "Löschmittel fehlt / nicht geprüft", keywords: ["feuerlöscher", "löschmittel", "löschdecke", "prüfung"], defaultRisk: "medium", sampleAction: "Geprüfte Feuerlöscher an bezeichneten Stellen bereitstellen." },
      { code: "brand.heissarbeiten", name: "Heissarbeiten", keywords: ["heissarbeiten", "schweissen", "trennschleifen", "funkenflug", "brandwache"], defaultRisk: "high", sampleAction: "Heissarbeitsbewilligung und Brandwache organisieren." },
      { code: "brand.gas", name: "Gasflaschen / brennbare Stoffe", keywords: ["gasflasche", "propan", "sauerstoff", "acetylen", "brennbar"], defaultRisk: "high", sampleAction: "Gasflaschen stehend und gegen Umfallen gesichert lagern." },
    ],
  },
  {
    code: "notfall", name: "Notfallorganisation und Erste Hilfe", defaultRisk: "medium",
    description: "Notfallkonzept, Alarmierung, Erste-Hilfe-Material und Ersthelfende.",
    keywords: ["notfall", "erste hilfe", "sanitätskasten", "notfallnummer", "alarmierung", "ersthelfer", "notfallplan", "rettung", "augenspülung"],
    internalRule: "Weisung Notfallorganisation (Platzhalter)",
    sampleAction: "Notfallplan aktualisieren und aushängen, Erste-Hilfe-Material ergänzen.",
    references: ["iso45001_82", "vuv"],
    subcategories: [
      { code: "notfall.material", name: "Erste-Hilfe-Material", keywords: ["sanitätskasten", "erste hilfe", "verbandsmaterial", "augenspülung", "abgelaufen"], defaultRisk: "medium", sampleAction: "Erste-Hilfe-Material ergänzen und Kontrollintervall festlegen." },
      { code: "notfall.plan", name: "Notfallplan / Alarmierung", keywords: ["notfallplan", "notfallnummer", "alarmierung", "rettungskonzept", "zufahrt rettung"], defaultRisk: "medium", sampleAction: "Notfallplan mit Standortangaben aushängen und instruieren." },
    ],
  },
  {
    code: "instruktion", name: "Instruktion, Qualifikation und Arbeitsvorbereitung", defaultRisk: "medium",
    description: "Instruktion, Ausbildungsnachweise, Arbeitsvorbereitung und Gefährdungsbeurteilung.",
    keywords: ["instruktion", "instruiert", "unterweisung", "ausbildung", "ausweis", "toolbox", "arbeitsvorbereitung", "gefährdungsermittlung", "sicherheitskonzept", "neue mitarbeitende"],
    internalRule: "Weisung Instruktion (Platzhalter)",
    sampleAction: "Instruktion durchführen und dokumentieren; Arbeitsvorbereitung mit Sicherheitsmassnahmen ergänzen.",
    references: ["vuv_info", "iso45001_72", "ekas_6508"],
    subcategories: [
      { code: "instruktion.nachweis", name: "Instruktion nicht nachgewiesen", keywords: ["instruktion", "nachweis", "unterweisung", "neue mitarbeitende", "temporär"], defaultRisk: "medium", sampleAction: "Instruktion nachholen und mit Unterschrift dokumentieren." },
      { code: "instruktion.av", name: "Arbeitsvorbereitung / Gefährdungsbeurteilung", keywords: ["arbeitsvorbereitung", "gefährdung", "sicherheitskonzept", "planung"], defaultRisk: "medium", sampleAction: "Gefährdungsermittlung ergänzen und Massnahmen festlegen." },
    ],
  },
  {
    code: "umwelt", name: "Umwelt, Abfall und Gewässerschutz", defaultRisk: "medium",
    description: "Abfalltrennung, Gewässerschutz, Betonwasser, Ölwannen.",
    keywords: ["umwelt", "abfall", "mulde", "trennung", "gewässer", "gewässerschutz", "ölwanne", "betonwasser", "absetzbecken", "entsorgung", "öl", "meteorwasser"],
    internalRule: "Weisung Umwelt / Entsorgung (Platzhalter)",
    sampleAction: "Abfall gemäss Entsorgungskonzept trennen; Betonwasser über Absetzbecken führen.",
    references: ["vvea", "gschg", "iso14001_81", "iso14001_82"],
    subcategories: [
      { code: "umwelt.abfall", name: "Abfalltrennung", keywords: ["abfall", "mulde", "trennung", "gemischt", "entsorgung"], defaultRisk: "low", sampleAction: "Mulden beschriften, Trennung instruieren." },
      { code: "umwelt.gewaesser", name: "Gewässerschutz / Betonwasser", keywords: ["betonwasser", "absetzbecken", "meteorwasser", "schacht", "zementwasser", "gewässer"], defaultRisk: "high", sampleAction: "Betonwasser neutralisieren, Schächte schützen." },
      { code: "umwelt.oel", name: "Öl / Treibstoff", keywords: ["öl", "ölwanne", "diesel", "tropft", "leck", "ölbindemittel"], defaultRisk: "medium", sampleAction: "Ölwanne unterstellen, Ölbindemittel bereitstellen." },
    ],
  },
  {
    code: "qualitaet", name: "Qualität, Ausführung und Mängel", defaultRisk: "low",
    description: "Ausführungsqualität, Planabweichungen, Schutz fertiger Bauteile.",
    keywords: ["qualität", "ausführung", "mangel", "mängel", "plan", "toleranz", "schutz", "beschädigung", "nacharbeit", "abnahme"],
    internalRule: "Qualitätsmanagement, Ausführungskontrolle (Platzhalter)",
    sampleAction: "Mangel dokumentieren, Nachbesserung mit Termin vereinbaren, Abnahme veranlassen.",
    references: ["iso9001_85", "iso9001_102", "sia118"],
    subcategories: [
      { code: "qualitaet.ausfuehrung", name: "Ausführungsmangel", keywords: ["mangel", "ausführung", "toleranz", "riss", "undicht", "falsch"], defaultRisk: "low", sampleAction: "Nachbesserung veranlassen und abnehmen." },
      { code: "qualitaet.schutz", name: "Schutz fertiger Bauteile", keywords: ["schutz", "abdeckung", "beschädigung", "verschmutzung"], defaultRisk: "low", sampleAction: "Fertige Bauteile schützen und abdecken." },
    ],
  },
  {
    code: "nachhaltigkeit", name: "Nachhaltigkeit / Ressourcen", defaultRisk: "low",
    description: "Energie- und Ressourceneffizienz, Leerlauf, Materialverschwendung.",
    keywords: ["nachhaltigkeit", "energie", "ressourcen", "leerlauf", "verschwendung", "wiederverwendung", "heizung", "beleuchtung brennt", "recycling"],
    internalRule: "Nachhaltigkeitsziele tozzo gruppe (Platzhalter)",
    sampleAction: "Leerläufe vermeiden, Bauheizung und Beleuchtung bedarfsgerecht steuern.",
    references: ["iso14001_81"],
    subcategories: [
      { code: "nachhaltigkeit.energie", name: "Energieverbrauch / Leerlauf", keywords: ["leerlauf", "energie", "heizung", "beleuchtung", "motor läuft"], defaultRisk: "low", sampleAction: "Leerlaufregelung kommunizieren, Zeitschaltuhren einsetzen." },
      { code: "nachhaltigkeit.material", name: "Materialeffizienz", keywords: ["verschwendung", "wiederverwendung", "recycling", "verschnitt"], defaultRisk: "low", sampleAction: "Materialbestellung optimieren, Wiederverwendung prüfen." },
    ],
  },
  {
    code: "organisation", name: "Organisation, Signalisation und Baustellenführung", defaultRisk: "medium",
    description: "Baustellenorganisation, Signalisation, Absperrungen, Baustelleninstallation.",
    keywords: ["organisation", "signalisation", "absperrung", "baustellentafel", "beschilderung", "abschrankung", "zutritt", "unbefugte", "baustelleninstallation", "sanitär"],
    internalRule: "Weisung Baustelleninstallation (Platzhalter)",
    sampleAction: "Signalisation und Absperrung gemäss Signalisationsplan ergänzen.",
    references: ["bauav", "int_sibe", "iso45001_812"],
    subcategories: [
      { code: "organisation.signalisation", name: "Signalisation / Absperrung", keywords: ["signalisation", "absperrung", "abschrankung", "beschilderung", "markierung", "gefahrenbereich"], defaultRisk: "medium", sampleAction: "Gefahrenbereich absperren und signalisieren." },
      { code: "organisation.zutritt", name: "Zutritt / Baustellenabschluss", keywords: ["zutritt", "unbefugte", "bauzaun", "tor offen", "abschluss"], defaultRisk: "medium", sampleAction: "Bauzaun schliessen, Zutrittsregelung durchsetzen." },
      { code: "organisation.installation", name: "Baustelleninstallation / Unterkünfte", keywords: ["unterkunft", "sanitär", "toilette", "garderobe", "installation"], defaultRisk: "low", sampleAction: "Sanitäre Einrichtungen und Unterkünfte instand halten." },
    ],
  },
];
