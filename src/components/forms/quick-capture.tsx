"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { AlertOctagon, AlertTriangle, Camera, CheckCircle2, CircleDot, Lightbulb, ThumbsUp, TriangleAlert, XCircle } from "lucide-react";
import type { Assessment, RiskLevel } from "@/lib/domain/enums";
import { compressImage } from "@/lib/offline/image-compress";
import { enqueueFinding } from "@/lib/offline/queue";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { VoiceButton } from "./voice-button";
import { uploadPhoto, type PendingPhoto } from "./photo-capture";
import { saveFindingAction } from "@/app/(app)/kontrollen/actions";

export interface QuickTemplate {
  title: string;
  categoryId: string | null;
  subcategoryId: string | null;
  assessment: Assessment;
  riskLevel: RiskLevel | null;
  action: string | null;
  responsibleRole: string | null;
}

const FALLBACK_ACTION = "Massnahme durch Bauleitung festzulegen (Schnellerfassung).";

export function QuickCapture({ inspection, templates }: { inspection: { id: string; label: string; context: string }; templates: QuickTemplate[] }) {
  const toast = useToast();
  const cameraRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [risk, setRisk] = useState<RiskLevel | null>(null);
  const [title, setTitle] = useState("");
  const [template, setTemplate] = useState<QuickTemplate | null>(null);
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [saved, setSaved] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    const list: PendingPhoto[] = [];
    for (const f of Array.from(files)) {
      const blob = await compressImage(f);
      list.push({ id: crypto.randomUUID(), blob, previewUrl: URL.createObjectURL(blob), caption: "" });
    }
    setPhotos((p) => [...p, ...list]);
    if (cameraRef.current) cameraRef.current.value = "";
  };

  const applyTemplate = (t: QuickTemplate) => {
    setTemplate(t);
    setTitle(t.title);
    setAssessment(t.assessment);
    setRisk(t.riskLevel);
  };

  const reset = () => {
    photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setPhotos([]);
    setTitle("");
    setAssessment(null);
    setRisk(null);
    setTemplate(null);
    setError(null);
  };

  const submit = () => {
    setError(null);
    if (!assessment) return setError("Bitte Beurteilung wählen.");
    if (title.trim().length < 3) return setError("Bitte einen kurzen Titel erfassen (mind. 3 Zeichen).");
    if (assessment !== "positive" && !risk) return setError("Bitte Risikostufe wählen.");
    const payload = {
      title: title.trim(),
      assessment,
      riskLevel: assessment === "positive" ? null : risk,
      categoryId: template?.categoryId ?? null,
      subcategoryId: template?.subcategoryId ?? null,
      responsibleRole: template?.responsibleRole ?? (assessment === "negative" && risk === "critical" ? "Bauleitung" : null),
      actionDescription: assessment === "positive" ? null : template?.action ?? FALLBACK_ACTION,
    };
    start(async () => {
      if (!navigator.onLine) {
        await enqueueFinding({
          id: crypto.randomUUID(), inspectionId: inspection.id, inspectionLabel: inspection.label, createdAt: new Date().toISOString(),
          payload, images: photos.map((p) => ({ id: p.id, blob: p.blob, caption: p.caption })), state: "pending",
        });
        toast("Offline gespeichert – Synchronisation folgt automatisch.", "info");
        setSaved((n) => n + 1);
        reset();
        return;
      }
      const res = await saveFindingAction({
        ...payload, inspectionId: inspection.id, referenceIds: [], aiReferenceIds: [], categoryId: payload.categoryId ?? "",
        subcategoryId: payload.subcategoryId ?? "", riskLevel: payload.riskLevel ?? "",
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      let failed = 0;
      for (const p of photos) if (!(await uploadPhoto(res.data.id, p)).ok) failed++;
      toast(failed ? `Gespeichert, ${failed} Foto(s) fehlgeschlagen.` : "Feststellung gespeichert.", failed ? "error" : "success");
      setSaved((n) => n + 1);
      reset();
    });
  };

  const tile = "flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border-2 text-base font-bold";
  return (
    <div className="space-y-5">
      <p className="rounded-lg bg-slate-200 px-3 py-2 text-sm"><span className="font-semibold">Automatisch übernommen:</span> {inspection.context}</p>
      {error && <Alert tone="error">{error}</Alert>}

      <button type="button" onClick={() => cameraRef.current?.click()} className="flex min-h-24 w-full items-center justify-center gap-3 rounded-xl bg-chrome text-2xl font-bold text-white active:bg-black">
        <Camera className="size-9" aria-hidden /> Foto aufnehmen {photos.length > 0 && `(${photos.length})`}
      </button>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" multiple className="sr-only" aria-label="Foto aufnehmen" onChange={(e) => addPhotos(e.target.files)} data-testid="quick-camera-input" />
      {photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p.id} src={p.previewUrl} alt="Vorschau" className="size-24 shrink-0 rounded-lg object-cover" />
          ))}
        </div>
      )}

      <fieldset>
        <legend className="mb-2 text-lg font-bold">Beurteilung</legend>
        <div className="grid grid-cols-3 gap-2">
          {([
            ["positive", "Positiv", ThumbsUp, "border-positive bg-positive text-white"],
            ["negative", "Abweichung", XCircle, "border-negative bg-negative text-white"],
            ["improvement", "Verbesserung", Lightbulb, "border-improve bg-improve text-white"],
          ] as const).map(([v, label, Icon, active]) => (
            <button key={v} type="button" aria-pressed={assessment === v} onClick={() => setAssessment(v)} className={cn(tile, assessment === v ? active : "border-line-strong bg-white")}>
              <Icon className="size-7" aria-hidden />{label}
            </button>
          ))}
        </div>
      </fieldset>

      {templates.length > 0 && (
        <div>
          <p className="mb-2 text-lg font-bold">Häufige Feststellungen</p>
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <button key={t.title} type="button" onClick={() => applyTemplate(t)} aria-pressed={template?.title === t.title}
                className={cn("min-h-12 rounded-full border-2 px-4 text-left text-sm font-semibold", template?.title === t.title ? "border-brand bg-brand-soft" : "border-line-strong bg-white")}>
                {t.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="quick-title" className="text-lg font-bold">Titel</label>
        <input id="quick-title" value={title} onChange={(e) => setTitle(e.target.value)} className="block min-h-14 w-full rounded-lg border-2 border-line-strong px-3 text-lg" placeholder="Kurz beschreiben …" />
        <VoiceButton onText={(t) => setTitle((x) => `${x} ${t}`.trim())} label="Titel diktieren" />
      </div>

      {assessment && assessment !== "positive" && (
        <fieldset>
          <legend className="mb-2 text-lg font-bold">Risikostufe</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {([
              ["low", "Niedrig", CircleDot, "border-slate-700 bg-slate-700 text-white"],
              ["medium", "Mittel", AlertTriangle, "border-risk-medium bg-risk-medium text-white"],
              ["high", "Hoch", TriangleAlert, "border-risk-high bg-risk-high text-white"],
              ["critical", "Kritisch", AlertOctagon, "border-risk-critical bg-risk-critical text-white"],
            ] as const).map(([v, label, Icon, active]) => (
              <button key={v} type="button" aria-pressed={risk === v} onClick={() => setRisk(v)} className={cn(tile, risk === v ? active : "border-line-strong bg-white")}>
                <Icon className="size-6" aria-hidden />{label}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <Button size="xl" className="w-full" onClick={submit} loading={pending}><CheckCircle2 className="size-7" aria-hidden /> Speichern</Button>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-ink-muted">{saved} in dieser Sitzung erfasst</span>
        <Link href={`/kontrollen/${inspection.id}`} className="font-semibold underline">Zur Kontrolle (Details ergänzen)</Link>
      </div>
    </div>
  );
}
