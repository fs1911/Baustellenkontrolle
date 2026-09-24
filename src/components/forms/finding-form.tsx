"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import {
  AlertOctagon,
  AlertTriangle,
  BookOpen,
  CircleDot,
  Lightbulb,
  Repeat,
  Save,
  Sparkles,
  ThumbsUp,
  Trash2,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { findingSchema, type FindingInput } from "@/lib/domain/validation";
import { completenessHints } from "@/lib/domain/classifier";
import type { ClassificationSuggestion } from "@/lib/domain/classifier";
import type { ScoreResult } from "@/lib/domain/recurrence";
import {
  ACTION_STATUSES,
  ACTION_STATUS_LABEL,
  ASSESSMENT_LABEL,
  REFERENCE_TYPE_LABEL,
  RISK_LABEL,
  type ReferenceType,
  type ReviewStatus,
} from "@/lib/domain/enums";
import { enqueueFinding } from "@/lib/offline/queue";
import { formatDate } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ChoiceGroup, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { AiBadge, AssessmentBadge, ReviewStatusBadge, RiskBadge, Tag } from "@/components/ui/badges";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { PhotoCapture, uploadPhoto, type PendingPhoto } from "./photo-capture";
import { VoiceButton } from "./voice-button";
import { deleteFindingAction, deleteImageAction, saveFindingAction, updateImageCaptionAction } from "@/app/(app)/kontrollen/actions";

export interface CatalogOption {
  id: string;
  name: string;
  sampleAction: string | null;
  referenceIds: string[];
  subcategories: { id: string; name: string; sampleAction: string | null }[];
}
export interface ReferenceOption {
  id: string;
  code: string;
  title: string;
  referenceType: ReferenceType;
  reviewStatus: ReviewStatus;
}
export interface ExistingImage {
  id: string;
  url: string;
  caption: string | null;
}

interface AiResponse {
  suggestionId: string;
  suggestion: ClassificationSuggestion;
  provider: string;
  mode: string;
  fallbackReason: string | null;
}

interface SimilarResponse {
  similar: {
    id: string;
    inspectionId: string;
    title: string;
    assessment: "positive" | "negative" | "improvement";
    riskLevel: "low" | "medium" | "high" | "critical" | null;
    siteName: string;
    createdAt: string;
    similarity: number;
    sameCategory: boolean;
    sameSite: boolean;
    actionDescription: string | null;
  }[];
  recurrence: ScoreResult | null;
}

const ROLE_SUGGESTIONS = [
  "Polier",
  "Bauleitung",
  "Projektleitung",
  "Vorarbeiter",
  "Subunternehmer",
  "Subunternehmer Elektro",
  "Gerüstbauer",
  "Kranführer",
  "SIBE",
];

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function FindingForm({
  inspection,
  catalog,
  references,
  defaults,
  existingImages = [],
  canDelete = false,
  readOnly = false,
}: {
  inspection: { id: string; siteId: string; label: string };
  catalog: CatalogOption[];
  references: ReferenceOption[];
  defaults: FindingInput;
  existingImages?: ExistingImage[];
  canDelete?: boolean;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [images, setImages] = useState(existingImages);
  const [serverError, setServerError] = useState<string | null>(null);
  const [ai, setAi] = useState<AiResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiApplied, setAiApplied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editing = !!defaults.id;

  const form = useForm<FindingInput>({ resolver: zodResolver(findingSchema), defaultValues: defaults });
  const {
    register,
    setValue,
    control,
    formState: { errors },
  } = form;
  const values = useWatch({ control });
  const assessment = values.assessment;
  const category = catalog.find((c) => c.id === values.categoryId);
  const suggestedRefIds = useMemo(() => new Set(category?.referenceIds ?? []), [category]);
  const selectedRefs = new Set(values.referenceIds ?? []);

  const hints = completenessHints({
    assessment: assessment ?? null,
    riskLevel: (values.riskLevel || null) as never,
    categoryId: values.categoryId || null,
    responsibleRole: values.responsibleRole || null,
    dueDate: values.dueDate || null,
    actionDescription: values.actionDescription || null,
    description: values.description || null,
    imageCount: images.length + photos.length,
  });

  // Ähnliche Feststellungen / Wiederholungshinweis (debounced)
  const text = useDebounced(`${values.title ?? ""} ${values.description ?? ""}`.trim(), 700);
  const similarQuery = useQuery({
    queryKey: ["similar", text, values.categoryId, values.subcategoryId, values.riskLevel, values.responsibleRole, assessment],
    enabled: text.length >= 6,
    queryFn: async (): Promise<SimilarResponse> => {
      const sp = new URLSearchParams({
        text,
        siteId: inspection.siteId,
        categoryId: values.categoryId ?? "",
        subcategoryId: values.subcategoryId ?? "",
        excludeId: defaults.id ?? "",
        riskLevel: values.riskLevel ?? "",
        responsibleRole: values.responsibleRole ?? "",
        assessment: assessment ?? "",
      });
      const res = await fetch(`/api/findings/similar?${sp}`);
      if (!res.ok) throw new Error("Fehler");
      return res.json();
    },
  });

  const requestAi = async () => {
    const title = form.getValues("title");
    if (!title || title.trim().length < 3) {
      form.setError("title", { message: "Für einen Vorschlag zuerst einen Titel erfassen." });
      return;
    }
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/classify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inspectionId: inspection.id, title, description: form.getValues("description") }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Fehler");
      setAi(body as AiResponse);
      setAiApplied(false);
    } catch (e) {
      toast((e as Error).message || "Vorschläge sind momentan nicht verfügbar.", "error");
    } finally {
      setAiLoading(false);
    }
  };

  const applyAi = () => {
    if (!ai) return;
    const s = ai.suggestion;
    if (s.assessment) setValue("assessment", s.assessment, { shouldValidate: true });
    if (s.categoryId) setValue("categoryId", s.categoryId);
    setValue("subcategoryId", s.subcategoryId ?? "");
    if (s.riskLevel) setValue("riskLevel", s.riskLevel);
    if (s.suggestedActions[0] && !form.getValues("actionDescription")) setValue("actionDescription", s.suggestedActions[0]);
    const refs = Array.from(new Set([...(form.getValues("referenceIds") ?? []), ...s.referenceIds]));
    setValue("referenceIds", refs);
    setValue("aiReferenceIds", s.referenceIds);
    setValue("aiSuggestionId", ai.suggestionId);
    setValue("aiDecision", "accepted");
    setAiApplied(true);
    toast("Vorschlag übernommen – bitte prüfen und bei Bedarf anpassen.", "info");
  };

  const rejectAi = () => {
    if (ai) {
      setValue("aiSuggestionId", ai.suggestionId);
      setValue("aiDecision", "rejected");
    }
    setAi(null);
  };

  // Änderungen nach Übernahme gelten als "angepasst"
  useEffect(() => {
    if (!aiApplied || !ai) return;
    const s = ai.suggestion;
    const changed =
      (s.categoryId && values.categoryId !== s.categoryId) ||
      (s.riskLevel && values.riskLevel !== s.riskLevel) ||
      (s.assessment && values.assessment !== s.assessment);
    setValue("aiDecision", changed ? "modified" : "accepted");
  }, [aiApplied, ai, values.categoryId, values.riskLevel, values.assessment, setValue]);

  const toggleRef = (id: string) => {
    const set = new Set(form.getValues("referenceIds") ?? []);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    setValue("referenceIds", Array.from(set));
  };

  const save = (next: "back" | "new") =>
    form.handleSubmit((data) => {
      setServerError(null);
      startTransition(async () => {
        if (!editing && typeof navigator !== "undefined" && !navigator.onLine) {
          await enqueueFinding({
            id: crypto.randomUUID(),
            inspectionId: inspection.id,
            inspectionLabel: inspection.label,
            createdAt: new Date().toISOString(),
            payload: {
              title: data.title,
              description: data.description ?? undefined,
              assessment: data.assessment,
              riskLevel: (data.riskLevel || null) as never,
              categoryId: data.categoryId || null,
              subcategoryId: data.subcategoryId || null,
              responsibleRole: data.responsibleRole || null,
              actionDescription: data.actionDescription || null,
              dueDate: data.dueDate || null,
            },
            images: photos.map((p) => ({ id: p.id, blob: p.blob, caption: p.caption })),
            state: "pending",
          });
          toast("Offline gespeichert – wird automatisch synchronisiert.", "info");
          form.reset({ ...defaults });
          setPhotos([]);
          return;
        }
        const res = await saveFindingAction(data);
        if (!res.ok) {
          setServerError(res.error);
          for (const [k, msg] of Object.entries(res.fieldErrors ?? {})) form.setError(k as keyof FindingInput, { message: msg });
          return;
        }
        let failed = 0;
        for (const p of photos) {
          const up = await uploadPhoto(res.data.id, p);
          if (!up.ok) failed++;
        }
        if (failed) toast(`${failed} Foto(s) konnten nicht hochgeladen werden.`, "error");
        else toast(res.message ?? "Gespeichert.");
        setPhotos([]);
        if (next === "new") {
          form.reset({
            ...defaults,
            id: null,
            title: "",
            description: "",
            actionDescription: "",
            referenceIds: [],
            aiReferenceIds: [],
            aiSuggestionId: null,
            aiDecision: null,
          });
          setAi(null);
          router.push(`/kontrollen/${inspection.id}/feststellungen/neu`);
          router.refresh();
        } else {
          router.push(`/kontrollen/${inspection.id}`);
          router.refresh();
        }
      });
    });

  const assessmentOptions = [
    {
      value: "positive" as const,
      label: ASSESSMENT_LABEL.positive,
      icon: <ThumbsUp className="size-6" aria-hidden />,
      activeClass: "border-positive bg-positive text-white",
    },
    {
      value: "negative" as const,
      label: ASSESSMENT_LABEL.negative,
      icon: <XCircle className="size-6" aria-hidden />,
      activeClass: "border-negative bg-negative text-white",
    },
    {
      value: "improvement" as const,
      label: "Verbesserung",
      icon: <Lightbulb className="size-6" aria-hidden />,
      activeClass: "border-improve bg-improve text-white",
    },
  ];
  const riskOptions = [
    {
      value: "low" as const,
      label: RISK_LABEL.low,
      icon: <CircleDot className="size-5" aria-hidden />,
      activeClass: "border-slate-700 bg-slate-700 text-white",
    },
    {
      value: "medium" as const,
      label: RISK_LABEL.medium,
      icon: <AlertTriangle className="size-5" aria-hidden />,
      activeClass: "border-risk-medium bg-risk-medium text-white",
    },
    {
      value: "high" as const,
      label: RISK_LABEL.high,
      icon: <TriangleAlert className="size-5" aria-hidden />,
      activeClass: "border-risk-high bg-risk-high text-white",
    },
    {
      value: "critical" as const,
      label: RISK_LABEL.critical,
      icon: <AlertOctagon className="size-5" aria-hidden />,
      activeClass: "border-risk-critical bg-risk-critical text-white",
    },
  ];

  const similar = similarQuery.data?.similar ?? [];
  const recurrence = similarQuery.data?.recurrence;

  return (
    <form onSubmit={save("back")} className="grid gap-5 lg:grid-cols-3" noValidate>
      <fieldset disabled={readOnly} className="space-y-5 lg:col-span-2">
        {serverError && <Alert tone="error">{serverError}</Alert>}

        <Card>
          <CardHeader title="Beobachtung" />
          <CardBody className="space-y-4">
            <ChoiceGroup
              name="assessment"
              legend="Beurteilung *"
              value={assessment}
              onChange={(v) => setValue("assessment", v, { shouldValidate: true })}
              options={assessmentOptions}
              error={errors.assessment?.message}
            />
            <Field label="Titel" htmlFor="title" required error={errors.title?.message}>
              <Input id="title" {...register("title")} placeholder="z. B. Seitenschutz am Deckenrand fehlt" aria-invalid={!!errors.title} />
            </Field>
            <Field label="Beschreibung / Kommentar" htmlFor="description" error={errors.description?.message}>
              <Textarea id="description" rows={4} {...register("description")} />
            </Field>
            <div className="flex flex-wrap gap-2">
              <VoiceButton onText={(t) => setValue("description", `${form.getValues("description") ?? ""} ${t}`.trim())} />
              <Button variant="outline" onClick={requestAi} loading={aiLoading}>
                <Sparkles className="size-5" aria-hidden /> Vorschlag erstellen
              </Button>
            </div>

            {ai && (
              <div className="space-y-3 rounded-lg border-2 border-violet-300 bg-violet-50 p-4" role="region" aria-label="KI-Vorschlag">
                <div className="flex flex-wrap items-center gap-2">
                  <AiBadge />
                  <span className="text-sm text-violet-900">
                    {ai.mode}
                    {ai.fallbackReason ? ` – ${ai.fallbackReason}` : ""}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ai.suggestion.assessment && <AssessmentBadge value={ai.suggestion.assessment} />}
                  {ai.suggestion.riskLevel && <RiskBadge value={ai.suggestion.riskLevel} />}
                  {ai.suggestion.categoryName && (
                    <Tag>
                      {ai.suggestion.categoryName}
                      {ai.suggestion.subcategoryName ? ` / ${ai.suggestion.subcategoryName}` : ""}
                    </Tag>
                  )}
                  <Tag>Konfidenz {Math.round(ai.suggestion.confidence * 100)} %</Tag>
                </div>
                {ai.suggestion.suggestedActions.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold">Mögliche Massnahmen</p>
                    <ul className="list-inside list-disc text-sm">
                      {ai.suggestion.suggestedActions.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <details className="text-sm">
                  <summary className="cursor-pointer font-semibold">Begründung anzeigen</summary>
                  <ul className="mt-1 list-inside list-disc">
                    {ai.suggestion.explanation.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </details>
                <p className="text-xs text-violet-900">Vorschläge sind unverbindlich und müssen fachlich geprüft werden.</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={applyAi} disabled={aiApplied}>
                    {aiApplied ? "Übernommen" : "Übernehmen"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={rejectAi}>
                    Verwerfen
                  </Button>
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Fotos" description={`${images.length + photos.length} Bild(er)`} />
          <CardBody className="space-y-4">
            {images.length > 0 && (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {images.map((img) => (
                  <li key={img.id} className="border-line overflow-hidden rounded-lg border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt={img.caption ?? "Foto zur Feststellung"} className="aspect-[4/3] w-full object-cover" />
                    {!readOnly && (
                      <div className="space-y-2 p-2">
                        <input
                          defaultValue={img.caption ?? ""}
                          aria-label="Bildlegende"
                          maxLength={500}
                          className="border-line-strong block min-h-11 w-full rounded-md border-2 px-2 text-sm"
                          onBlur={async (e) => {
                            if (e.target.value !== (img.caption ?? "")) {
                              const r = await updateImageCaptionAction(img.id, e.target.value);
                              toast(r.ok ? "Bildlegende gespeichert." : r.error, r.ok ? "success" : "error");
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="text-negative hover:bg-negative-soft flex min-h-10 w-full items-center justify-center gap-1 rounded-md text-sm font-semibold"
                          onClick={async () => {
                            const r = await deleteImageAction(img.id);
                            if (r.ok) setImages((l) => l.filter((x) => x.id !== img.id));
                            toast(r.ok ? "Bild entfernt." : r.error, r.ok ? "success" : "error");
                          }}
                        >
                          <Trash2 className="size-4" aria-hidden /> Entfernen
                        </button>
                      </div>
                    )}
                    {readOnly && img.caption && <p className="p-2 text-sm">{img.caption}</p>}
                  </li>
                ))}
              </ul>
            )}
            {!readOnly && <PhotoCapture photos={photos} onChange={setPhotos} />}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Einordnung" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Kategorie"
              htmlFor="categoryId"
              required={assessment === "negative" && values.riskLevel === "critical"}
              error={errors.categoryId?.message}
            >
              <Select id="categoryId" {...register("categoryId", { onChange: () => setValue("subcategoryId", "") })}>
                <option value="">Kategorie wählen …</option>
                {catalog.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Unterkategorie" htmlFor="subcategoryId">
              <Select id="subcategoryId" {...register("subcategoryId")} disabled={!category}>
                <option value="">–</option>
                {category?.subcategories.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            {assessment !== "positive" && (
              <div className="sm:col-span-2">
                <ChoiceGroup
                  name="riskLevel"
                  legend="Risikostufe / Dringlichkeit *"
                  columns={4}
                  value={values.riskLevel || null}
                  onChange={(v) => setValue("riskLevel", v, { shouldValidate: true })}
                  options={riskOptions}
                  error={errors.riskLevel?.message}
                />
              </div>
            )}
            <Field label="Betroffener Bereich / Gewerk" htmlFor="trade">
              <Input id="trade" {...register("trade")} placeholder="z. B. Rohbau" />
            </Field>
            <Field label="Ort auf der Baustelle" htmlFor="location">
              <Input id="location" {...register("location")} placeholder="z. B. 2. OG Nord" />
            </Field>
          </CardBody>
        </Card>

        {assessment !== "positive" && (
          <Card>
            <CardHeader title="Massnahme" />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Massnahme bzw. Massnahmenvorschlag"
                htmlFor="actionDescription"
                required
                error={errors.actionDescription?.message}
                className="sm:col-span-2"
              >
                <Textarea id="actionDescription" rows={3} {...register("actionDescription")} aria-invalid={!!errors.actionDescription} />
              </Field>
              {(category?.subcategories.find((s) => s.id === values.subcategoryId)?.sampleAction || category?.sampleAction) &&
                !values.actionDescription && (
                  <div className="sm:col-span-2">
                    <p className="mb-1 text-sm font-semibold">Muster-Massnahme aus dem Katalog</p>
                    <button
                      type="button"
                      className="border-line-strong rounded-lg border-2 border-dashed bg-slate-50 px-3 py-2 text-left text-sm hover:bg-slate-100"
                      onClick={() =>
                        setValue(
                          "actionDescription",
                          category?.subcategories.find((s) => s.id === values.subcategoryId)?.sampleAction ?? category?.sampleAction ?? "",
                        )
                      }
                    >
                      {category?.subcategories.find((s) => s.id === values.subcategoryId)?.sampleAction ?? category?.sampleAction}{" "}
                      <span className="text-info font-semibold">übernehmen</span>
                    </button>
                  </div>
                )}
              <Field
                label="Verantwortliche Rolle"
                htmlFor="responsibleRole"
                required={assessment === "negative" && values.riskLevel === "critical"}
                error={errors.responsibleRole?.message}
              >
                <Input id="responsibleRole" list="role-suggestions" {...register("responsibleRole")} />
                <datalist id="role-suggestions">
                  {ROLE_SUGGESTIONS.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </Field>
              <Field label="Verantwortliche Person (optional)" htmlFor="responsiblePerson">
                <Input id="responsiblePerson" {...register("responsiblePerson")} />
              </Field>
              <Field label="Frist" htmlFor="dueDate" error={errors.dueDate?.message}>
                <Input id="dueDate" type="date" {...register("dueDate")} />
              </Field>
              {editing && (
                <Field label="Status" htmlFor="status">
                  <Select id="status" {...register("status")}>
                    {ACTION_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {ACTION_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              {editing && values.status && values.status !== "open" && values.status !== "in_progress" && (
                <Field
                  label={values.status === "resolved" ? "Abschlussbemerkung" : "Verifikationsbemerkung"}
                  htmlFor="completionNote"
                  required={values.status !== "resolved"}
                  error={errors.completionNote?.message}
                  className="sm:col-span-2"
                >
                  <Textarea id="completionNote" rows={2} {...register("completionNote")} />
                </Field>
              )}
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader
            title="Referenzen / Orientierungshilfen"
            description="Verknüpfte Regel- und Rechtsbezüge dienen als Orientierung. Einträge «zu prüfen» sind noch nicht durch das IMS freigegeben."
          />
          <CardBody className="space-y-3">
            {references.length === 0 && <p className="text-ink-muted">Keine Referenzen im Katalog.</p>}
            <ul className="space-y-2">
              {references
                .filter((r) => suggestedRefIds.has(r.id) || selectedRefs.has(r.id))
                .map((r) => (
                  <li key={r.id}>
                    <label className="border-line flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border p-2 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        className="mt-1 size-6 accent-[var(--color-brand)]"
                        checked={selectedRefs.has(r.id)}
                        onChange={() => toggleRef(r.id)}
                      />
                      <span className="min-w-0 text-sm">
                        <span className="font-semibold">{r.code}</span> – {r.title}
                        <span className="mt-1 flex flex-wrap gap-1">
                          <Tag>{REFERENCE_TYPE_LABEL[r.referenceType]}</Tag>
                          <ReviewStatusBadge value={r.reviewStatus} />
                          {suggestedRefIds.has(r.id) && <AiBadge />}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
            </ul>
            <Field label="Weitere Referenz hinzufügen" htmlFor="addRef">
              <Select id="addRef" value="" onChange={(e) => e.target.value && toggleRef(e.target.value)}>
                <option value="">Referenz wählen …</option>
                {references
                  .filter((r) => !selectedRefs.has(r.id) && !suggestedRefIds.has(r.id))
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {REFERENCE_TYPE_LABEL[r.referenceType]} – {r.code}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Bemerkung zur Referenz (optional)" htmlFor="referenceNote">
              <Input id="referenceNote" {...register("referenceNote")} placeholder="z. B. projektspezifische Vorgabe" />
            </Field>
          </CardBody>
        </Card>

        {!readOnly && (
          <div className="border-line sticky bottom-20 z-20 flex flex-wrap gap-2 rounded-xl border bg-white/95 p-3 shadow-lg backdrop-blur md:bottom-4">
            <Button type="submit" size="lg" loading={pending}>
              <Save className="size-5" aria-hidden /> Speichern
            </Button>
            {!editing && (
              <Button size="lg" variant="secondary" onClick={save("new")} loading={pending}>
                Speichern &amp; nächste
              </Button>
            )}
            {editing && canDelete && (
              <Button variant="ghost" className="text-negative ml-auto" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="size-5" aria-hidden /> Löschen
              </Button>
            )}
          </div>
        )}
      </fieldset>

      <aside className="space-y-4" aria-label="Hinweise">
        {hints.length > 0 && !readOnly && (
          <Card>
            <CardHeader title="Hinweise zur Vollständigkeit" />
            <CardBody>
              <ul className="space-y-2 text-sm">
                {hints.map((h) => (
                  <li
                    key={h.message}
                    className={h.level === "error" ? "text-negative flex gap-2 font-semibold" : "text-improve flex gap-2"}
                  >
                    {h.level === "error" ? (
                      <AlertOctagon className="mt-0.5 size-4 shrink-0" aria-hidden />
                    ) : (
                      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                    )}
                    {h.message}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        )}

        {recurrence && recurrence.score > 0 && (
          <Card className="border-violet-300">
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <Repeat className="size-5" aria-hidden /> Wiederholungshinweis
                </span>
              }
              description={`Score ${recurrence.score} · Priorität ${recurrence.priority === "high" ? "hoch" : recurrence.priority === "medium" ? "mittel" : "niedrig"}`}
            />
            <CardBody>
              <ul className="space-y-1.5 text-sm">
                {recurrence.items.map((i) => (
                  <li key={i.criterion} className="flex justify-between gap-2">
                    <span>
                      {i.label}
                      <span className="text-ink-muted block text-xs">{i.detail}</span>
                    </span>
                    <span className="font-semibold">+{i.points}</span>
                  </li>
                ))}
              </ul>
              <p className="text-ink-muted mt-3 text-xs">Datenbasierte Unterstützung zur Prävention – keine Bewertung von Personen.</p>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <BookOpen className="size-5" aria-hidden /> Ähnliche frühere Feststellungen
              </span>
            }
            description="Kriterien: Textähnlichkeit, gleiche Kategorie, gleiche Baustelle"
          />
          <CardBody>
            {text.length < 6 ? (
              <p className="text-ink-muted text-sm">Erscheint nach Eingabe von Titel bzw. Beschreibung.</p>
            ) : similarQuery.isLoading ? (
              <p className="text-ink-muted text-sm">Suche läuft …</p>
            ) : similar.length === 0 ? (
              <p className="text-ink-muted text-sm">Keine ähnlichen Feststellungen gefunden.</p>
            ) : (
              <ul className="space-y-3">
                {similar.map((s) => (
                  <li key={s.id} className="border-line rounded-lg border p-2 text-sm">
                    <a href={`/kontrollen/${s.inspectionId}/feststellungen/${s.id}`} className="font-semibold hover:underline">
                      {s.title}
                    </a>
                    <p className="text-ink-muted text-xs">
                      {s.siteName} · {formatDate(s.createdAt)}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <AssessmentBadge value={s.assessment} />
                      <Tag>{Math.round(s.similarity * 100)} % Textähnlichkeit</Tag>
                      {s.sameCategory && <Tag>gleiche Kategorie</Tag>}
                      {s.sameSite && <Tag>gleiche Baustelle</Tag>}
                    </div>
                    {s.actionDescription && (
                      <p className="mt-1 text-xs">
                        <span className="font-semibold">Damalige Massnahme:</span> {s.actionDescription}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </aside>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Feststellung löschen?"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Abbrechen
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await deleteFindingAction(defaults.id!, inspection.id);
                  toast(r.ok ? (r.message ?? "Gelöscht.") : r.error, r.ok ? "success" : "error");
                  if (r.ok) {
                    router.push(`/kontrollen/${inspection.id}`);
                    router.refresh();
                  }
                })
              }
            >
              Löschen
            </Button>
          </>
        }
      >
        <p>Die Feststellung wird als gelöscht markiert und erscheint nicht mehr im Bericht.</p>
      </Dialog>
    </form>
  );
}
