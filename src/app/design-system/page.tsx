import type { Metadata } from "next";
import { Camera, Plus, Save } from "lucide-react";
import { ACTION_STATUSES, ASSESSMENTS, REPORT_STATUSES, RISK_LEVELS } from "@/lib/domain/enums";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { ActionStatusBadge, AiBadge, AssessmentBadge, ReportStatusBadge, ReviewStatusBadge, RiskBadge } from "@/components/ui/badges";
import { Table, THead, Th, Td } from "@/components/ui/table";
import { KpiTile } from "@/components/charts/tables";
import { CHART } from "@/components/charts/charts";

export const metadata: Metadata = { title: "Design-System" };

const COLORS = [
  ["ink", "#0f172a", "Text primär"], ["ink-muted", "#475569", "Text sekundär"], ["line", "#cbd5e1", "Linien"], ["canvas", "#f1f5f9", "Hintergrund"],
  ["chrome", "#111827", "Navigation"], ["brand", "#c2410c", "Aktion / Marke"], ["positive", "#15803d", "Positiv / erledigt"], ["negative", "#b91c1c", "Abweichung / kritisch / überfällig"],
  ["improve", "#b45309", "Verbesserung / in Bearbeitung"], ["info", "#1d4ed8", "Information / Fokus"],
];

export default function DesignSystemPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-10">
      <header>
        <h1 className="text-3xl font-bold">Design-System Baustellenkontrolle</h1>
        <p className="text-ink-muted">Grundlagen: hoher Kontrast für Sonnenlicht, Touch-Ziele ≥ 48 px (Handschuhe), Status nie nur über Farbe (immer Icon + Text), sachliche Industrieästhetik, Schweizer Hochdeutsch.</p>
      </header>

      <Card><CardHeader title="Farbpalette" description="Tokens in src/app/globals.css (@theme)" /><CardBody className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {COLORS.map(([name, hex, use]) => (
          <div key={name} className="overflow-hidden rounded-lg border border-line"><div className="h-14" style={{ background: hex }} /><div className="p-2 text-sm"><p className="font-semibold">{name}</p><p className="font-mono text-xs">{hex}</p><p className="text-xs text-ink-muted">{use}</p></div></div>
        ))}
      </CardBody></Card>

      <Card><CardHeader title="Typografie und Abstände" /><CardBody className="space-y-2">
        <p className="text-3xl font-bold">Seitentitel 30/36 fett</p><p className="text-xl font-bold">Abschnitt 20 fett</p><p className="text-lg font-semibold">Kartentitel 18 halbfett</p>
        <p>Fliesstext 16 – Systemschrift (offline verfügbar, keine externe Schrift)</p><p className="text-sm text-ink-muted">Hilfstext 14</p>
        <p className="text-sm">Abstände: 4-px-Raster (Tailwind-Skala), Karten 16–20 px Innenabstand, Seitenrand mobil 12 px, Desktop 32 px.</p>
      </CardBody></Card>

      <Card><CardHeader title="Buttons" /><CardBody className="flex flex-wrap gap-3">
        <Button><Save className="size-5" aria-hidden /> Primär</Button><Button variant="secondary">Sekundär</Button><Button variant="outline">Kontur</Button>
        <Button variant="success">Bestätigen</Button><Button variant="danger">Löschen</Button><Button variant="ghost">Ghost</Button>
        <Button size="xl"><Plus className="size-6" aria-hidden /> Gross (Baustelle)</Button><Button loading>Lädt</Button><Button disabled>Deaktiviert</Button>
      </CardBody></Card>

      <Card><CardHeader title="Badges (Status und Risiko)" /><CardBody className="space-y-3">
        <div className="flex flex-wrap gap-2">{ASSESSMENTS.map((a) => <AssessmentBadge key={a} value={a} />)}</div>
        <div className="flex flex-wrap gap-2">{RISK_LEVELS.map((r) => <RiskBadge key={r} value={r} />)}</div>
        <div className="flex flex-wrap gap-2">{ACTION_STATUSES.map((s) => <ActionStatusBadge key={s} value={s} />)}<ActionStatusBadge value="open" overdue /></div>
        <div className="flex flex-wrap gap-2">{REPORT_STATUSES.map((s) => <ReportStatusBadge key={s} value={s} />)}<ReviewStatusBadge value="to_review" /><ReviewStatusBadge value="approved" /><AiBadge /></div>
      </CardBody></Card>

      <Card><CardHeader title="Formularelemente" /><CardBody className="grid gap-4 md:grid-cols-2">
        <Field label="Textfeld" htmlFor="ds-1" required hint="Hilfetext"><Input id="ds-1" placeholder="Platzhalter" /></Field>
        <Field label="Mit Fehler" htmlFor="ds-2" error="Bitte einen Titel erfassen."><Input id="ds-2" aria-invalid /></Field>
        <Field label="Auswahl" htmlFor="ds-3"><Select id="ds-3"><option>Option</option></Select></Field>
        <Field label="Mehrzeilig" htmlFor="ds-4"><Textarea id="ds-4" rows={2} /></Field>
        <Checkbox id="ds-5" label="Checkbox mit grossem Klickbereich" />
      </CardBody></Card>

      <div className="grid gap-4 md:grid-cols-4">
        <KpiTile label="Kennzahl" value={42} /><KpiTile label="Positiv" value={17} tone="positive" /><KpiTile label="Überfällig" value={3} tone="negative" trend={{ delta: 2, goodWhenDown: true }} /><KpiTile label="In Bearbeitung" value={5} tone="warning" />
      </div>

      <Card><CardHeader title="Rückmeldungen, Leer- und Ladezustände" /><CardBody className="space-y-3">
        <Alert tone="success" title="Erfolg">Bericht versendet.</Alert><Alert tone="warning" title="Hinweis">Frist fehlt.</Alert><Alert tone="error" title="Fehler">Verständlich, nicht technisch formuliert.</Alert><Alert tone="info">Information</Alert>
        <EmptyState icon={<Camera className="size-10" aria-hidden />} title="Noch keine Feststellungen" description="Leerzustände enthalten immer eine Handlungsaufforderung." action={<Button>Erste Feststellung</Button>} />
        <div className="flex gap-2"><Skeleton className="h-10 w-40" /><Skeleton className="h-10 w-64" /></div>
        <p className="text-sm text-ink-muted">Toasts erscheinen unten zentriert (mobil oberhalb der Tab-Leiste); Modal-Dialoge basieren auf dem nativen &lt;dialog&gt; (Fokusfalle, Escape).</p>
      </CardBody></Card>

      <Card><CardHeader title="Tabellen" /><CardBody>
        <Table caption="Beispiel"><THead><tr><Th>Spalte</Th><Th>Wert</Th></tr></THead><tbody><tr><Td>Zeile</Td><Td>1</Td></tr></tbody></Table>
      </CardBody></Card>

      <Card><CardHeader title="Diagrammstil" /><CardBody className="space-y-2 text-sm">
        <div className="flex flex-wrap gap-2">{Object.entries(CHART).map(([k, v]) => <span key={k} className="inline-flex items-center gap-2 rounded border border-line px-2 py-1"><span className="size-4 rounded" style={{ background: v }} />{k}</span>)}</div>
        <ul className="list-inside list-disc">
          <li>Beurteilungen: Statusfarben mit Legende, 2-px-Abstand zwischen Segmenten, Tooltip und Tabellenansicht (Farbpalette validiert, CVD-Grenzbereich durch Sekundärcodierung abgesichert).</li>
          <li>Magnitude: eine Farbe (Blau), eine Achse, Werte direkt beschriftet; Heatmap sequenziell hell→dunkel mit Zahl in jeder Zelle.</li>
          <li>Jede Grafik ist anklickbar und führt auf die gefilterten Feststellungen.</li>
        </ul>
      </CardBody></Card>

      <Card><CardHeader title="PDF-Berichtsdesign" /><CardBody className="text-sm">
        <ul className="list-inside list-disc">
          <li>A4, Ränder 44 pt, Helvetica; Deckblatt mit Logo, Titelbalken in Markenfarbe der Gesellschaft, Metadatentabelle.</li>
          <li>Kopfzeile (Logo, Bericht-ID, Baustelle, Datum) und Fusszeile (Seite x von y, Gesellschaft, Bericht-ID, Version, Erstellungszeitpunkt) auf jeder Inhaltsseite.</li>
          <li>Feststellungskarten mit Farbbalken und Textlabels (ABWEICHUNG, RISIKO, STATUS, ÜBERFÄLLIG), Fotos zweispaltig mit Bildlegende.</li>
          <li>Massnahmentabelle sortiert nach überfällig → offen → Risiko → Frist; überfällige Zeilen hervorgehoben und textlich markiert.</li>
        </ul>
      </CardBody></Card>
    </main>
  );
}
