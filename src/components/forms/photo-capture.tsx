"use client";

import { useRef } from "react";
import { Camera, ImagePlus, Trash2 } from "lucide-react";
import { compressImage } from "@/lib/offline/image-compress";

export interface PendingPhoto {
  id: string;
  blob: Blob;
  previewUrl: string;
  caption: string;
}

/** Kamera (mobil: Rückkamera) und Galerie/Dateiauswahl mit Sofortvorschau und Bildlegende. */
export function PhotoCapture({
  photos,
  onChange,
  disabled,
}: {
  photos: PendingPhoto[];
  onChange: (p: PendingPhoto[]) => void;
  disabled?: boolean;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    const next: PendingPhoto[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) continue;
      const blob = await compressImage(file);
      next.push({ id: crypto.randomUUID(), blob, previewUrl: URL.createObjectURL(blob), caption: "" });
    }
    onChange([...photos, ...next]);
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => cameraRef.current?.click()}
          className="bg-chrome flex min-h-16 items-center justify-center gap-2 rounded-lg px-3 text-lg font-semibold text-white hover:bg-black disabled:opacity-50"
        >
          <Camera className="size-6" aria-hidden /> Foto aufnehmen
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => galleryRef.current?.click()}
          className="border-line-strong flex min-h-16 items-center justify-center gap-2 rounded-lg border-2 bg-white px-3 text-lg font-semibold hover:bg-slate-50 disabled:opacity-50"
        >
          <ImagePlus className="size-6" aria-hidden /> Aus Galerie
        </button>
      </div>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-label="Foto mit Kamera aufnehmen"
        onChange={(e) => add(e.target.files)}
        data-testid="camera-input"
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        className="sr-only"
        aria-label="Fotos aus Galerie wählen"
        onChange={(e) => add(e.target.files)}
        data-testid="gallery-input"
      />
      {photos.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((p, idx) => (
            <li key={p.id} className="border-line overflow-hidden rounded-lg border bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.previewUrl} alt={p.caption || `Neues Foto ${idx + 1}`} className="aspect-[4/3] w-full object-cover" />
              <div className="space-y-2 p-2">
                <input
                  value={p.caption}
                  onChange={(e) => onChange(photos.map((x) => (x.id === p.id ? { ...x, caption: e.target.value } : x)))}
                  placeholder="Bildlegende"
                  aria-label={`Bildlegende Foto ${idx + 1}`}
                  maxLength={500}
                  className="border-line-strong block min-h-11 w-full rounded-md border-2 px-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(p.previewUrl);
                    onChange(photos.filter((x) => x.id !== p.id));
                  }}
                  className="text-negative hover:bg-negative-soft flex min-h-10 w-full items-center justify-center gap-1 rounded-md text-sm font-semibold"
                >
                  <Trash2 className="size-4" aria-hidden /> Entfernen
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-ink-muted text-sm">
        Fotos werden verkleinert und ohne Standortdaten (GPS) gespeichert, sofern nicht anders konfiguriert.
      </p>
    </div>
  );
}

export async function uploadPhoto(findingId: string, photo: PendingPhoto): Promise<{ ok: boolean; error?: string }> {
  const form = new FormData();
  form.set("file", photo.blob, `${photo.id}.jpg`);
  form.set("caption", photo.caption);
  try {
    const res = await fetch(`/api/findings/${findingId}/images`, { method: "POST", body: form });
    if (res.ok) return { ok: true };
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: body.error ?? "Upload fehlgeschlagen" };
  } catch {
    return { ok: false, error: "Keine Verbindung" };
  }
}
