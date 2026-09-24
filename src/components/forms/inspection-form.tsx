"use client";

import { useMemo, useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Check, Plus, Trash2 } from "lucide-react";
import { inspectionSchema, type InspectionInput } from "@/lib/domain/validation";
import { INSPECTION_TYPES, INSPECTION_TYPE_LABEL } from "@/lib/domain/enums";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { SiteDialog, type CreatedSite } from "./site-dialog";
import { createInspectionAction, updateInspectionAction } from "@/app/(app)/kontrollen/actions";

interface Company { id: string; name: string; shortCode: string }
interface Site { id: string; companyId: string; name: string; siteNumber: string; street: string | null; postalCode: string | null; city: string | null }
interface Template { id: string; name: string; companyId: string | null }

export function InspectionForm({
  companies, sites: initialSites, templates, creatableCompanyIds, inspector, defaults, inspectionId,
}: {
  companies: Company[];
  sites: Site[];
  templates: Template[];
  creatableCompanyIds: string[];
  inspector: string;
  defaults: InspectionInput;
  inspectionId?: string;
}) {
  const [sites, setSites] = useState(initialSites);
  const [siteDialog, setSiteDialog] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const editing = !!inspectionId;
  const form = useForm<InspectionInput>({ resolver: zodResolver(inspectionSchema), defaultValues: defaults });
  const participants = useFieldArray({ control: form.control, name: "participants" });
  const companyId = form.watch("companyId");
  const siteId = form.watch("siteId");
  const errors = form.formState.errors;

  const selectableCompanies = useMemo(
    () => companies.filter((c) => sites.some((s) => s.companyId === c.id) || creatableCompanyIds.includes(c.id)),
    [companies, sites, creatableCompanyIds],
  );
  const companySites = sites.filter((s) => s.companyId === companyId);
  const site = sites.find((s) => s.id === siteId);

  const submit = form.handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const res = editing ? await updateInspectionAction(inspectionId, values) : await createInspectionAction(values);
      if (res && !res.ok) {
        setServerError(res.error);
        for (const [k, msg] of Object.entries(res.fieldErrors ?? {})) form.setError(k as keyof InspectionInput, { message: msg });
      } else if (res?.ok && editing) {
        toast(res.message ?? "Gespeichert.");
      }
    });
  });

  const onSiteCreated = (s: CreatedSite) => {
    setSites((list) => [...list, s]);
    form.setValue("siteId", s.id, { shouldValidate: true });
  };

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {serverError && <Alert tone="error">{serverError}</Alert>}

      <Card>
        <CardHeader title="1. Gesellschaft" description="Pflichtangabe – bestimmt Logo, Corporate Design und Berichtsnummer." />
        <CardBody>
          {selectableCompanies.length === 0 ? (
            <Alert tone="warning">Ihnen ist keine Baustelle zugeordnet. Bitte wenden Sie sich an die Administration.</Alert>
          ) : (
            <div role="radiogroup" aria-label="Gesellschaft wählen" className="grid gap-2 sm:grid-cols-3">
              {selectableCompanies.map((c) => {
                const active = companyId === c.id;
                return (
                  <button key={c.id} type="button" role="radio" aria-checked={active} disabled={editing}
                    onClick={() => { form.setValue("companyId", c.id, { shouldValidate: true }); form.setValue("siteId", ""); }}
                    className={cn("flex min-h-16 items-center gap-3 rounded-lg border-2 px-4 text-left font-semibold",
                      active ? "border-brand bg-brand-soft" : "border-line-strong bg-white hover:bg-slate-50", editing && !active && "opacity-50")}>
                    {active ? <Check className="size-6 text-brand" aria-hidden /> : <Building2 className="size-6 text-ink-subtle" aria-hidden />}
                    <span>{c.name}<span className="block text-xs font-normal text-ink-muted">{c.shortCode}</span></span>
                  </button>
                );
              })}
            </div>
          )}
          {errors.companyId && <p className="mt-2 text-sm font-semibold text-negative" role="alert">Bitte eine Gesellschaft wählen.</p>}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="2. Baustelle / Projekt" actions={companyId && creatableCompanyIds.includes(companyId) && !editing && (
          <Button variant="outline" size="sm" onClick={() => setSiteDialog(true)}><Plus className="size-4" aria-hidden /> Neue Baustelle</Button>
        )} />
        <CardBody className="space-y-4">
          <Field label="Baustelle" htmlFor="siteId" required error={errors.siteId ? "Bitte eine Baustelle wählen." : undefined}>
            <Select id="siteId" {...form.register("siteId")} disabled={!companyId || editing} aria-invalid={!!errors.siteId}>
              <option value="">{companyId ? "Baustelle wählen …" : "Zuerst Gesellschaft wählen"}</option>
              {companySites.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.siteNumber})</option>)}
            </Select>
          </Field>
          {site && (
            <dl className="grid gap-2 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-2">
              <div><dt className="text-ink-muted">Baustellen-/Projektnummer</dt><dd className="font-semibold">{site.siteNumber}</dd></div>
              <div><dt className="text-ink-muted">Adresse</dt><dd className="font-semibold">{[site.street, [site.postalCode, site.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "–"}</dd></div>
            </dl>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="3. Angaben zur Kontrolle" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Datum und Uhrzeit" htmlFor="inspectedAt" required error={errors.inspectedAt?.message}>
            <Input id="inspectedAt" type="datetime-local" {...form.register("inspectedAt")} />
          </Field>
          <Field label="Kontrolltyp" htmlFor="inspectionType" required>
            <Select id="inspectionType" {...form.register("inspectionType")}>
              {INSPECTION_TYPES.map((t) => <option key={t} value={t}>{INSPECTION_TYPE_LABEL[t]}</option>)}
            </Select>
          </Field>
          <Field label="Kontrollierende Person" htmlFor="inspector"><Input id="inspector" value={inspector} readOnly disabled /></Field>
          <Field label="Kontrollvorlage" htmlFor="templateId" hint="Liefert häufige Feststellungen für die Schnellerfassung.">
            <Select id="templateId" {...form.register("templateId")} disabled={editing}>
              <option value="">Keine</option>
              {templates.filter((t) => !t.companyId || t.companyId === companyId).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </Field>
          <Field label="Wetter (optional)" htmlFor="weather"><Input id="weather" placeholder="z. B. sonnig, 18 °C" {...form.register("weather")} /></Field>
          <Field label="Kontrollbereich / Gewerk (optional)" htmlFor="area"><Input id="area" placeholder="z. B. Rohbau, Fassade" {...form.register("area")} /></Field>
          <Field label="Bemerkungen (optional)" htmlFor="notes" className="sm:col-span-2"><Textarea id="notes" rows={3} {...form.register("notes")} /></Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="4. Weitere anwesende Personen" actions={
          <Button variant="outline" size="sm" onClick={() => participants.append({ fullName: "", functionLabel: "", organisation: "" })}><Plus className="size-4" aria-hidden /> Person hinzufügen</Button>
        } />
        <CardBody className="space-y-3">
          {participants.fields.length === 0 && <p className="text-ink-muted">Keine weiteren Personen erfasst.</p>}
          {participants.fields.map((f, i) => (
            <div key={f.id} className="grid gap-2 rounded-lg border border-line p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <Field label="Name" htmlFor={`p-${i}-name`} error={errors.participants?.[i]?.fullName?.message}><Input id={`p-${i}-name`} {...form.register(`participants.${i}.fullName`)} /></Field>
              <Field label="Funktion" htmlFor={`p-${i}-fn`}><Input id={`p-${i}-fn`} placeholder="z. B. Polier" {...form.register(`participants.${i}.functionLabel`)} /></Field>
              <Field label="Firma" htmlFor={`p-${i}-org`}><Input id={`p-${i}-org`} {...form.register(`participants.${i}.organisation`)} /></Field>
              <Button variant="ghost" className="self-end" onClick={() => participants.remove(i)} aria-label={`Person ${i + 1} entfernen`}><Trash2 className="size-5" aria-hidden /></Button>
            </div>
          ))}
        </CardBody>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="xl" loading={pending} disabled={selectableCompanies.length === 0}>
          {editing ? "Änderungen speichern" : "Kontrolle starten"}
        </Button>
      </div>

      {companyId && <SiteDialog open={siteDialog} onClose={() => setSiteDialog(false)} companyId={companyId} onCreated={onSiteCreated} />}
    </form>
  );
}
