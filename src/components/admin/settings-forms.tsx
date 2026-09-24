"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AllSettings, SettingsKey } from "@/lib/domain/settings";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { retentionAction, saveSettingAction } from "@/app/(app)/admin/actions";

const SCORING_LABELS: Record<string, string> = {
  windowDays: "Zeitraum (Tage)", sameSubcategory: "Gleiche Unterkategorie", similarText: "Ähnliche Beschreibung", sameSite: "Gleiche Baustelle",
  sameProject: "Gleiches Projekt", sameCompany: "Gleiche Gesellschaft", sameTrade: "Gleicher Bereich / Gewerk", sameResponsibleRole: "Gleiche Verantwortungsrolle",
  highRisk: "Hohe/kritische Risikostufe", overdueAction: "Überfällige Massnahme", perAdditional: "Je weitere Feststellung", maxAdditional: "Max. weitere Feststellungen",
  similarityThreshold: "Schwelle Textähnlichkeit (0–1)", minClusterSize: "Mindestgrösse Cluster", highPriorityScore: "Schwelle Priorität hoch", mediumPriorityScore: "Schwelle Priorität mittel",
};
const RETENTION_LABELS: Record<string, string> = {
  inspectionsYears: "Kontrollen, Feststellungen, Berichte (Jahre)", imagesYears: "Fotos (Jahre)", emailLogYears: "Versandprotokolle (Jahre)",
  auditLogYears: "Audit Log (Jahre)", aiSuggestionsDays: "KI-Vorschläge (Tage)",
};

export function SettingsForms({ initial, externalConfigured }: { initial: AllSettings; externalConfigured: boolean }) {
  const [s, setS] = useState(initial);
  const [pending, start] = useTransition();
  const [retention, setRetention] = useState<Record<string, number | boolean> | null>(null);
  const toast = useToast();
  const router = useRouter();
  const save = (key: SettingsKey) => start(async () => {
    const r = await saveSettingAction(key, s[key]);
    toast(r.ok ? r.message ?? "Gespeichert." : r.error, r.ok ? "success" : "error");
    if (r.ok) router.refresh();
  });
  const num = <K extends "recurrence.scoring" | "retention">(key: K, field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setS({ ...s, [key]: { ...s[key], [field]: Number(e.target.value) } });

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="KI-Verarbeitung" description="Ohne Freigabe arbeitet die App ausschliesslich mit dem lokalen, regelbasierten Verfahren." />
        <CardBody className="space-y-2">
          {!externalConfigured && <Alert tone="info">Es ist kein externer KI-Dienst konfiguriert (AI_PROVIDER/ANTHROPIC_API_KEY). Die Einstellungen werden wirksam, sobald dies der Fall ist.</Alert>}
          <Checkbox id="ai-ext" label="Externe KI-Dienste für Textvorschläge zulassen (Feststellungstexte werden an den Anbieter übermittelt)" checked={s.ai.allowExternal} onChange={(e) => setS({ ...s, ai: { ...s.ai, allowExternal: e.target.checked } })} />
          <Checkbox id="ai-img" label="Fotos an externe KI-Dienste übermitteln (Bildinhalte können Personen zeigen – nur mit Einwilligung/Rechtsgrundlage)" checked={s.ai.allowImages} disabled={!s.ai.allowExternal} onChange={(e) => setS({ ...s, ai: { ...s.ai, allowImages: e.target.checked } })} />
          <Button onClick={() => save("ai")} loading={pending}>Speichern</Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Fotos und Metadaten" />
        <CardBody className="space-y-2">
          <Checkbox id="img-strip" label="Metadaten (EXIF inkl. GPS-Standort, Gerätedaten) beim Upload entfernen (empfohlen)" checked={s.images.stripMetadata} onChange={(e) => setS({ ...s, images: { stripMetadata: e.target.checked } })} />
          <Button onClick={() => save("images")} loading={pending}>Speichern</Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Aufbewahrungs- und Löschfristen" description="Trockenlauf zeigt betroffene Datensätze; die Ausführung löscht endgültig und wird protokolliert." />
        <CardBody className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            {Object.entries(s.retention).map(([k, v]) => (
              <Field key={k} label={RETENTION_LABELS[k] ?? k} htmlFor={`ret-${k}`}><Input id={`ret-${k}`} type="number" min={1} value={v} onChange={num("retention", k)} /></Field>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => save("retention")} loading={pending}>Speichern</Button>
            <Button variant="outline" loading={pending} onClick={() => start(async () => { const r = await retentionAction(false); if (r.ok) setRetention(r.data as never); else toast(r.error, "error"); })}>Trockenlauf</Button>
            <Button variant="danger" loading={pending} disabled={!retention} onClick={() => { if (confirm("Löschlauf jetzt endgültig ausführen?")) start(async () => { const r = await retentionAction(true); if (r.ok) { setRetention(r.data as never); toast("Löschlauf ausgeführt."); } else toast(r.error, "error"); }); }}>Löschlauf ausführen</Button>
          </div>
          {retention && (
            <dl className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 text-sm md:grid-cols-4">
              {Object.entries(retention).filter(([k]) => k !== "execute").map(([k, v]) => <div key={k}><dt className="text-ink-muted">{k}</dt><dd className="font-bold">{String(v)}</dd></div>)}
            </dl>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Punktemodell wiederkehrende Abweichungen" description="Wirksam bei der nächsten Neuberechnung" />
        <CardBody className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(s["recurrence.scoring"]).map(([k, v]) => (
              <Field key={k} label={SCORING_LABELS[k] ?? k} htmlFor={`sc-${k}`}><Input id={`sc-${k}`} type="number" step={k === "similarityThreshold" ? 0.05 : 1} value={v} onChange={num("recurrence.scoring", k)} /></Field>
            ))}
          </div>
          <Button onClick={() => save("recurrence.scoring")} loading={pending}>Speichern</Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Standardtexte für Berichte" />
        <CardBody className="space-y-3">
          <Field label="Standard-Disclaimer" htmlFor="rep-disc"><Textarea id="rep-disc" rows={4} value={s.reports.defaultDisclaimer} onChange={(e) => setS({ ...s, reports: { ...s.reports, defaultDisclaimer: e.target.value } })} /></Field>
          <Field label="Standard-Schlussbemerkung" htmlFor="rep-close"><Textarea id="rep-close" rows={4} value={s.reports.closingText} onChange={(e) => setS({ ...s, reports: { ...s.reports, closingText: e.target.value } })} /></Field>
          <Button onClick={() => save("reports")} loading={pending}>Speichern</Button>
        </CardBody>
      </Card>
    </div>
  );
}
