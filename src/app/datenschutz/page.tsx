import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Datenschutzhinweise" };

/**
 * Datenschutzhinweise (Vorlage). Verantwortliche Stelle, Kontaktangaben und Fristen sind durch die
 * tozzo gruppe ag bzw. deren Datenschutzberatung zu prüfen und zu finalisieren.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10 leading-relaxed">
      <p><Link href="/dashboard" className="font-semibold underline">← Zur Anwendung</Link></p>
      <h1 className="text-3xl font-bold">Datenschutzhinweise Baustellenkontrolle</h1>
      <p className="rounded-lg border-2 border-amber-300 bg-amber-50 p-3 text-sm">Vorlage – durch die verantwortliche Stelle und die Datenschutzberatung zu prüfen und zu ergänzen (Stand: Einführung).</p>
      <section className="space-y-2">
        <h2 className="text-xl font-bold">1. Verantwortliche Stelle</h2>
        <p>tozzo gruppe ag bzw. die jeweils gewählte Gesellschaft der Gruppe (Kontaktangaben und Datenschutzberatung: zu ergänzen). Rechtsgrundlage ist das Schweizer Datenschutzgesetz (DSG) samt Verordnung (DSV).</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-bold">2. Zweck der Bearbeitung</h2>
        <p>Die Anwendung dient der Durchführung und Dokumentation betrieblicher Baustellenkontrollen, der Umsetzung und Verifikation von Massnahmen zur Arbeitssicherheit, Qualität und Umwelt sowie der Auswertung im integrierten Managementsystem (ISO 9001, ISO 14001, ISO 45001).</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-bold">3. Bearbeitete Daten</h2>
        <ul className="list-inside list-disc">
          <li>Benutzerkonto: Name, geschäftliche E-Mail-Adresse, Funktion, Rollen, Baustellenzuordnungen.</li>
          <li>Kontrolldaten: Baustelle, Zeitpunkt, kontrollierende und anwesende Personen, Feststellungen, Massnahmen, Verantwortungsrollen.</li>
          <li>Fotos der Baustelle. Auf Fotos können Personen erkennbar sein.</li>
          <li>Protokolle: Änderungen, Freigaben, Versand, Anmeldungen und Exporte (Audit Log).</li>
        </ul>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-bold">4. Hinweise zur Bildbearbeitung</h2>
        <ul className="list-inside list-disc">
          <li>Fotografieren Sie Situationen und Einrichtungen, nicht Personen. Vermeiden Sie erkennbare Gesichter, wo dies für die Feststellung nicht erforderlich ist.</li>
          <li>Standortdaten (GPS) und weitere Metadaten werden beim Upload standardmässig entfernt; Fotos werden verkleinert gespeichert.</li>
          <li>Fotos sind nicht öffentlich zugänglich; Links sind kurzzeitig gültig und nur für Berechtigte abrufbar.</li>
        </ul>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-bold">5. KI-gestützte Vorschläge</h2>
        <p>Vorschläge werden standardmässig lokal und regelbasiert erzeugt. Eine Übermittlung von Texten oder Fotos an externe KI-Dienste erfolgt nur, wenn die Administration dies ausdrücklich freigegeben hat. KI-Vorschläge sind als solche gekennzeichnet und werden erst nach menschlicher Prüfung übernommen. Es erfolgen keine automatisierten Einzelentscheidungen und keine Bewertung von Personen.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-bold">6. Empfänger und Speicherort</h2>
        <p>Berichte werden nur nach ausdrücklicher Freigabe an die gewählten Empfänger versendet. Hosting und Datenbank: gemäss Betriebskonzept (z. B. Supabase, Region EU/CH; Auftragsbearbeitung zu vereinbaren). Details: docs/security.md.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-bold">7. Aufbewahrung und Löschung</h2>
        <p>Daten werden gemäss den in der Anwendung konfigurierten Aufbewahrungsfristen gelöscht (Standard: Kontrollen 10 Jahre, Fotos 5 Jahre, Audit Log 10 Jahre). Soft-gelöschte Fotos werden nach 30 Tagen endgültig entfernt.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-bold">8. Ihre Rechte</h2>
        <p>Sie haben insbesondere das Recht auf Auskunft, Berichtigung und Löschung (im Rahmen gesetzlicher Aufbewahrungspflichten). Eine Datenauskunft Ihrer Kontodaten können Sie unter «Profil» selbst herunterladen.</p>
      </section>
    </main>
  );
}
