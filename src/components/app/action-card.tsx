"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, ChevronDown, MessageSquare } from "lucide-react";
import { ACTION_STATUS_LABEL, type ActionStatus, type RiskLevel } from "@/lib/domain/enums";
import { compressImage } from "@/lib/offline/image-compress";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/form";
import { ActionStatusBadge, RiskBadge } from "@/components/ui/badges";
import { useToast } from "@/components/ui/toast";
import { updateActionStatusAction } from "@/app/(app)/massnahmen/actions";

export interface ActionCardData {
  id: string;
  findingId: string;
  inspectionId: string;
  siteName: string;
  companyName: string;
  findingTitle: string;
  description: string;
  responsible: string | null;
  dueDate: string | null;
  status: ActionStatus;
  riskLevel: RiskLevel | null;
  overdue: boolean;
  updates: {
    id: string;
    comment: string | null;
    statusFrom: ActionStatus | null;
    statusTo: ActionStatus | null;
    createdAt: string;
    authorName: string | null;
    attachments: { id: string; url: string; fileName: string }[];
  }[];
}

export function ActionCard({ a, canVerify }: { a: ActionCardData; canVerify: boolean }) {
  const [status, setStatus] = useState<ActionStatus>(a.status);
  const [comment, setComment] = useState("");
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const router = useRouter();
  const allowed: ActionStatus[] = canVerify
    ? ["open", "in_progress", "resolved", "verified", "closed"]
    : a.status === "verified" || a.status === "closed"
      ? [a.status]
      : ["open", "in_progress", "resolved"];

  const save = () =>
    start(async () => {
      const r = await updateActionStatusAction({ actionId: a.id, status, comment: comment || null });
      toast(r.ok ? (r.message ?? "Gespeichert.") : r.error, r.ok ? "success" : "error");
      if (r.ok) {
        setComment("");
        router.refresh();
      }
    });

  const upload = (files: FileList | null) =>
    start(async () => {
      if (!files?.[0]) return;
      const blob = await compressImage(files[0]);
      const form = new FormData();
      form.set("file", blob, files[0].name || "nachweis.jpg");
      form.set("comment", comment || "Abschlussnachweis (Foto)");
      const res = await fetch(`/api/actions/${a.id}/evidence`, { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      toast(res.ok ? "Nachweis gespeichert." : (body.error ?? "Upload fehlgeschlagen."), res.ok ? "success" : "error");
      if (fileRef.current) fileRef.current.value = "";
      if (res.ok) router.refresh();
    });

  return (
    <article
      className="border-line space-y-3 rounded-[var(--radius-card)] border bg-white p-4 shadow-[var(--shadow-card)]"
      aria-label={`Massnahme zu ${a.findingTitle}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/kontrollen/${a.inspectionId}/feststellungen/${a.findingId}`} className="font-semibold underline">
            {a.findingTitle}
          </Link>
          <p className="text-ink-muted text-sm">
            {a.siteName} · {a.companyName}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <RiskBadge value={a.riskLevel} />
          <ActionStatusBadge value={a.status} overdue={a.overdue} />
        </div>
      </div>
      <p>{a.description}</p>
      <p className="text-ink-muted text-sm">
        Verantwortlich: {a.responsible ?? "–"} · Frist:{" "}
        <span className={a.overdue ? "text-negative font-bold" : ""}>{a.dueDate ? formatDate(a.dueDate) : "–"}</span>
      </p>
      <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
        <Field label="Neuer Status" htmlFor={`st-${a.id}`}>
          <Select id={`st-${a.id}`} value={status} onChange={(e) => setStatus(e.target.value as ActionStatus)}>
            {allowed.map((s) => (
              <option key={s} value={s}>
                {ACTION_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label={status === "verified" || status === "closed" ? "Verifikationsbemerkung (Pflicht)" : "Kommentar"}
          htmlFor={`cm-${a.id}`}
        >
          <Textarea id={`cm-${a.id}`} rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={save} loading={pending}>
          <MessageSquare className="size-5" aria-hidden /> Speichern
        </Button>
        <Button variant="outline" onClick={() => fileRef.current?.click()} loading={pending}>
          <Camera className="size-5" aria-hidden /> Nachweis-Foto
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          aria-label="Abschlussnachweis hochladen"
          onChange={(e) => upload(e.target.files)}
        />
        {!canVerify && <p className="text-ink-muted self-center text-sm">Verifikation erfolgt durch Projektleitung bzw. SIBE.</p>}
      </div>
      {a.updates.length > 0 && (
        <div>
          <button
            type="button"
            className="text-info flex min-h-10 items-center gap-1 text-sm font-semibold"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
          >
            <ChevronDown className={open ? "size-4 rotate-180" : "size-4"} aria-hidden /> Verlauf ({a.updates.length})
          </button>
          {open && (
            <ol className="border-line mt-2 space-y-2 border-l-2 pl-3 text-sm">
              {a.updates.map((u) => (
                <li key={u.id}>
                  <p className="text-ink-muted text-xs">
                    {formatDateTime(u.createdAt)} · {u.authorName ?? "System"}
                    {u.statusFrom !== u.statusTo && u.statusTo
                      ? ` · ${ACTION_STATUS_LABEL[u.statusFrom ?? "open"]} → ${ACTION_STATUS_LABEL[u.statusTo]}`
                      : ""}
                  </p>
                  {u.comment && <p>{u.comment}</p>}
                  {u.attachments.map((at) => (
                    <a key={at.id} href={at.url} target="_blank" rel="noopener">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={at.url} alt={`Nachweis ${at.fileName}`} className="mt-1 h-24 rounded object-cover" />
                    </a>
                  ))}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </article>
  );
}
