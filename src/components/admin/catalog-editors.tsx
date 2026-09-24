"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RISK_LEVELS, RISK_LABEL, REFERENCE_TYPES, REFERENCE_TYPE_LABEL, type ReferenceType, type RiskLevel } from "@/lib/domain/enums";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { reviewReferenceAction, saveCategoryAction, saveReferenceAction, saveSubcategoryAction } from "@/app/(app)/admin/actions";

function useSaver() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const router = useRouter();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, after?: () => void) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) return setError(r.error ?? "Fehler");
      toast(r.message ?? "Gespeichert.");
      after?.();
      router.refresh();
    });
  return { pending, error, run };
}

export interface CategoryEdit { id: string; name: string; description: string; defaultRisk: RiskLevel; keywords: string; internalRule: string; sampleAction: string; isActive: boolean }

export function CategoryEditor({ initial }: { initial: CategoryEdit }) {
  const [c, setC] = useState(initial);
  const { pending, error, run } = useSaver();
  const id = c.id;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {error && <Alert tone="error" className="md:col-span-2">{error}</Alert>}
      <Field label="Name" htmlFor={`c-${id}-name`}><Input id={`c-${id}-name`} value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} /></Field>
      <Field label="Risikostandard" htmlFor={`c-${id}-risk`}>
        <Select id={`c-${id}-risk`} value={c.defaultRisk} onChange={(e) => setC({ ...c, defaultRisk: e.target.value as RiskLevel })}>{RISK_LEVELS.map((r) => <option key={r} value={r}>{RISK_LABEL[r]}</option>)}</Select>
      </Field>
      <Field label="Beschreibung" htmlFor={`c-${id}-desc`} className="md:col-span-2"><Input id={`c-${id}-desc`} value={c.description} onChange={(e) => setC({ ...c, description: e.target.value })} /></Field>
      <Field label="Schlagworte / Synonyme (für KI-Klassifikation)" htmlFor={`c-${id}-kw`} className="md:col-span-2" hint="Kommagetrennt"><Textarea id={`c-${id}-kw`} rows={2} value={c.keywords} onChange={(e) => setC({ ...c, keywords: e.target.value })} /></Field>
      <Field label="Interne Regelung / Prozess" htmlFor={`c-${id}-rule`}><Input id={`c-${id}-rule`} value={c.internalRule} onChange={(e) => setC({ ...c, internalRule: e.target.value })} /></Field>
      <Field label="Muster-Massnahme" htmlFor={`c-${id}-act`}><Input id={`c-${id}-act`} value={c.sampleAction} onChange={(e) => setC({ ...c, sampleAction: e.target.value })} /></Field>
      <Checkbox id={`c-${id}-active`} label="Aktiv" checked={c.isActive} onChange={(e) => setC({ ...c, isActive: e.target.checked })} />
      <div><Button loading={pending} onClick={() => run(() => saveCategoryAction(c))}>Kategorie speichern</Button></div>
    </div>
  );
}

export interface SubcategoryEdit { id: string | null; categoryId: string; code: string; name: string; defaultRisk: RiskLevel | ""; keywords: string; sampleAction: string; isActive: boolean }

export function SubcategoryEditor({ initial }: { initial: SubcategoryEdit }) {
  const [s, setS] = useState(initial);
  const { pending, error, run } = useSaver();
  const id = s.id ?? `new-${s.categoryId}`;
  return (
    <div className="grid gap-2 rounded-lg border border-line p-3 md:grid-cols-[1fr_1fr_160px]">
      {error && <Alert tone="error" className="md:col-span-3">{error}</Alert>}
      <Field label="Name" htmlFor={`s-${id}-name`}><Input id={`s-${id}-name`} value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} /></Field>
      <Field label="Code" htmlFor={`s-${id}-code`}><Input id={`s-${id}-code`} value={s.code} onChange={(e) => setS({ ...s, code: e.target.value })} disabled={!!s.id} /></Field>
      <Field label="Risiko" htmlFor={`s-${id}-risk`}>
        <Select id={`s-${id}-risk`} value={s.defaultRisk} onChange={(e) => setS({ ...s, defaultRisk: e.target.value as RiskLevel | "" })}><option value="">wie Kategorie</option>{RISK_LEVELS.map((r) => <option key={r} value={r}>{RISK_LABEL[r]}</option>)}</Select>
      </Field>
      <Field label="Schlagworte" htmlFor={`s-${id}-kw`} className="md:col-span-2"><Input id={`s-${id}-kw`} value={s.keywords} onChange={(e) => setS({ ...s, keywords: e.target.value })} /></Field>
      <Checkbox id={`s-${id}-active`} label="Aktiv" checked={s.isActive} onChange={(e) => setS({ ...s, isActive: e.target.checked })} />
      <Field label="Muster-Massnahme" htmlFor={`s-${id}-act`} className="md:col-span-2"><Input id={`s-${id}-act`} value={s.sampleAction} onChange={(e) => setS({ ...s, sampleAction: e.target.value })} /></Field>
      <div className="self-end"><Button size="sm" loading={pending} onClick={() => run(() => saveSubcategoryAction(s))}>{s.id ? "Speichern" : "Hinzufügen"}</Button></div>
    </div>
  );
}

export interface ReferenceEdit { id: string | null; referenceType: ReferenceType; code: string; title: string; description: string; url: string; source: string; retrievedAt: string; sourceVersion: string; categoryIds: string[] }

export function ReferenceEditor({ initial, categories, onDone }: { initial: ReferenceEdit; categories: { id: string; name: string }[]; onDone?: () => void }) {
  const [r, setR] = useState(initial);
  const { pending, error, run } = useSaver();
  const id = r.id ?? "new";
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {error && <Alert tone="error" className="md:col-span-2">{error}</Alert>}
      {r.id && <Alert tone="info" className="md:col-span-2">Speichern erzeugt eine neue Version mit Status «zu prüfen». Die bisherige Version wird deaktiviert, bleibt aber in früheren Berichten nachvollziehbar.</Alert>}
      <Field label="Typ" htmlFor={`r-${id}-type`}><Select id={`r-${id}-type`} value={r.referenceType} onChange={(e) => setR({ ...r, referenceType: e.target.value as ReferenceType })}>{REFERENCE_TYPES.map((t) => <option key={t} value={t}>{REFERENCE_TYPE_LABEL[t]}</option>)}</Select></Field>
      <Field label="Bezeichnung / Fundstelle" htmlFor={`r-${id}-code`} hint="z. B. «BauAV Art. …» – nur verifizierte Angaben"><Input id={`r-${id}-code`} value={r.code} onChange={(e) => setR({ ...r, code: e.target.value })} /></Field>
      <Field label="Titel" htmlFor={`r-${id}-title`} className="md:col-span-2"><Input id={`r-${id}-title`} value={r.title} onChange={(e) => setR({ ...r, title: e.target.value })} /></Field>
      <Field label="Beschreibung" htmlFor={`r-${id}-desc`} className="md:col-span-2"><Textarea id={`r-${id}-desc`} rows={2} value={r.description} onChange={(e) => setR({ ...r, description: e.target.value })} /></Field>
      <Field label="Link (https)" htmlFor={`r-${id}-url`}><Input id={`r-${id}-url`} value={r.url} onChange={(e) => setR({ ...r, url: e.target.value })} placeholder="https://www.fedlex.admin.ch/…" /></Field>
      <Field label="Quelle" htmlFor={`r-${id}-src`}><Input id={`r-${id}-src`} value={r.source} onChange={(e) => setR({ ...r, source: e.target.value })} /></Field>
      <Field label="Abrufdatum" htmlFor={`r-${id}-ret`}><Input id={`r-${id}-ret`} type="date" value={r.retrievedAt} onChange={(e) => setR({ ...r, retrievedAt: e.target.value })} /></Field>
      <Field label="Version / Stand der Quelle" htmlFor={`r-${id}-ver`}><Input id={`r-${id}-ver`} value={r.sourceVersion} onChange={(e) => setR({ ...r, sourceVersion: e.target.value })} /></Field>
      <fieldset className="md:col-span-2">
        <legend className="mb-1 text-sm font-semibold">Verknüpfte Kategorien</legend>
        <div className="grid gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <Checkbox key={c.id} id={`r-${id}-cat-${c.id}`} label={c.name} checked={r.categoryIds.includes(c.id)}
              onChange={(e) => setR({ ...r, categoryIds: e.target.checked ? [...r.categoryIds, c.id] : r.categoryIds.filter((x) => x !== c.id) })} />
          ))}
        </div>
      </fieldset>
      <div><Button loading={pending} onClick={() => run(() => saveReferenceAction(r), onDone)}>{r.id ? "Neue Version speichern" : "Referenz anlegen"}</Button></div>
    </div>
  );
}

export function ReviewButtons({ id, status }: { id: string; status: "to_review" | "approved" | "retired" }) {
  const [note, setNote] = useState("");
  const { pending, error, run } = useSaver();
  return (
    <div className="space-y-2">
      {error && <Alert tone="error">{error}</Alert>}
      <Input aria-label="Prüfvermerk" placeholder="Prüfvermerk (z. B. geprüft gegen Fassung vom …)" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        {status !== "approved" && <Button size="sm" variant="success" loading={pending} onClick={() => run(() => reviewReferenceAction({ id, decision: "approved", note }))}>Prüfen und freigeben</Button>}
        {status !== "retired" && <Button size="sm" variant="outline" loading={pending} onClick={() => run(() => reviewReferenceAction({ id, decision: "retired", note }))}>Ausser Kraft setzen</Button>}
        {status !== "to_review" && <Button size="sm" variant="ghost" loading={pending} onClick={() => run(() => reviewReferenceAction({ id, decision: "to_review", note }))}>Zurück auf «zu prüfen»</Button>}
      </div>
    </div>
  );
}
