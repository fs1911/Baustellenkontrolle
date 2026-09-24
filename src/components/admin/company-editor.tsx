"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { saveCompanyAction } from "@/app/(app)/admin/actions";

export interface CompanyData {
  id: string | null; name: string; shortCode: string; street: string; postalCode: string; city: string; primaryColor: string;
  emailSenderName: string; defaultDistribution: string; reportDisclaimer: string; confidentialityNote: string; isActive: boolean; logoUrl: string | null;
}

export function CompanyEditor({ initial }: { initial: CompanyData }) {
  const [c, setC] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const [logo, setLogo] = useState(initial.logoUrl);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const router = useRouter();
  const id = c.id ?? "new";
  const set = (k: keyof CompanyData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setC({ ...c, [k]: e.target.value });

  const save = () => start(async () => {
    setError(null);
    const r = await saveCompanyAction({
      ...c, defaultDistribution: c.defaultDistribution.split(/[,;\s]+/).filter(Boolean),
    });
    if (!r.ok) { setError(r.error); setFieldErrors(r.fieldErrors ?? {}); return; }
    toast(r.message ?? "Gespeichert.");
    setC({ ...c, id: r.data.id });
    router.refresh();
  });

  const uploadLogo = (files: FileList | null) => start(async () => {
    if (!files?.[0] || !c.id) return;
    const form = new FormData();
    form.set("companyId", c.id);
    form.set("file", files[0]);
    const res = await fetch("/api/admin/logo", { method: "POST", body: form });
    const body = await res.json();
    if (!res.ok) return toast(body.error ?? "Upload fehlgeschlagen", "error");
    setLogo(body.url);
    toast("Logo aktualisiert – wird in neuen Berichten verwendet.");
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {error && <Alert tone="error" className="md:col-span-2">{error}</Alert>}
      <Field label="Firmenname" htmlFor={`${id}-name`} required error={fieldErrors.name}><Input id={`${id}-name`} value={c.name} onChange={set("name")} /></Field>
      <Field label="Gesellschaftskürzel" htmlFor={`${id}-code`} required error={fieldErrors.shortCode} hint="Wird in der Bericht-ID verwendet"><Input id={`${id}-code`} value={c.shortCode} onChange={set("shortCode")} maxLength={8} /></Field>
      <Field label="Strasse" htmlFor={`${id}-street`}><Input id={`${id}-street`} value={c.street} onChange={set("street")} /></Field>
      <div className="grid grid-cols-[120px_1fr] gap-2">
        <Field label="PLZ" htmlFor={`${id}-plz`}><Input id={`${id}-plz`} value={c.postalCode} onChange={set("postalCode")} /></Field>
        <Field label="Ort" htmlFor={`${id}-city`}><Input id={`${id}-city`} value={c.city} onChange={set("city")} /></Field>
      </div>
      <Field label="Primäre Markenfarbe" htmlFor={`${id}-color`} error={fieldErrors.primaryColor}>
        <div className="flex gap-2"><input type="color" aria-label="Farbwähler" value={c.primaryColor || "#1f2937"} onChange={set("primaryColor")} className="h-12 w-16 rounded border-2 border-line-strong" /><Input id={`${id}-color`} value={c.primaryColor} onChange={set("primaryColor")} placeholder="#c2410c" /></div>
      </Field>
      <Field label="E-Mail-Absendername" htmlFor={`${id}-sender`}><Input id={`${id}-sender`} value={c.emailSenderName} onChange={set("emailSenderName")} /></Field>
      <Field label="Standard-E-Mail-Verteiler" htmlFor={`${id}-dist`} className="md:col-span-2" hint="Mehrere Adressen mit Komma trennen" error={Object.entries(fieldErrors).find(([k]) => k.startsWith("defaultDistribution"))?.[1]}>
        <Input id={`${id}-dist`} value={c.defaultDistribution} onChange={set("defaultDistribution")} />
      </Field>
      <Field label="Rechtlicher Hinweis / Disclaimer für Berichte" htmlFor={`${id}-disc`} className="md:col-span-2" hint="Leer = Standard-Disclaimer aus den Einstellungen">
        <Textarea id={`${id}-disc`} rows={3} value={c.reportDisclaimer} onChange={set("reportDisclaimer")} />
      </Field>
      <Field label="Vertraulichkeitshinweis (optional)" htmlFor={`${id}-conf`} className="md:col-span-2"><Input id={`${id}-conf`} value={c.confidentialityNote} onChange={set("confidentialityNote")} /></Field>
      <Checkbox id={`${id}-active`} label="Aktiv" checked={c.isActive} onChange={(e) => setC({ ...c, isActive: e.target.checked })} />
      <div className="flex flex-wrap items-center gap-3 md:col-span-2">
        <Button onClick={save} loading={pending}>Speichern</Button>
        {c.id && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logo && <img src={logo} alt={`Logo ${c.name}`} className="h-12 w-auto rounded border border-line bg-white p-1" />}
            <Button variant="outline" onClick={() => fileRef.current?.click()} loading={pending}><Upload className="size-5" aria-hidden /> Logo hochladen</Button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="sr-only" aria-label="Logo-Datei wählen" onChange={(e) => uploadLogo(e.target.files)} />
            <span className="text-sm text-ink-muted">PNG, JPEG, SVG oder WebP, max. 5 MB</span>
          </>
        )}
      </div>
    </div>
  );
}
