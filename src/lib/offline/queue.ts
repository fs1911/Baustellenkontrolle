"use client";

import { createStore, del, entries, get, set } from "idb-keyval";

/**
 * Offline-Warteschlange für Schnellerfassungen (IndexedDB).
 * Fotos werden als Blob gespeichert und bei wiederhergestellter Verbindung idempotent
 * (client_ref) an /api/sync/findings übertragen.
 */
export interface QueuedFinding {
  id: string; // client_ref
  inspectionId: string;
  inspectionLabel: string;
  createdAt: string;
  payload: {
    title: string;
    description?: string;
    assessment: "positive" | "negative" | "improvement";
    riskLevel?: "low" | "medium" | "high" | "critical" | null;
    subcategoryId?: string | null;
    categoryId?: string | null;
    responsibleRole?: string | null;
    actionDescription?: string | null;
    dueDate?: string | null;
  };
  images: { id: string; blob: Blob; caption: string }[];
  state: "pending" | "error";
  error?: string;
}

const store = () => createStore("baustellenkontrolle", "offline-queue");
export const QUEUE_EVENT = "bk-queue-changed";

function notify() {
  window.dispatchEvent(new Event(QUEUE_EVENT));
}

export async function enqueueFinding(item: QueuedFinding): Promise<void> {
  await set(item.id, item, store());
  notify();
}

export async function listQueue(): Promise<QueuedFinding[]> {
  const all = await entries<string, QueuedFinding>(store());
  return all.map(([, v]) => v).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function removeFromQueue(id: string): Promise<void> {
  await del(id, store());
  notify();
}

let syncing = false;

/** Überträgt ausstehende Erfassungen. Bricht bei Netzwerkfehlern ab und versucht es später erneut. */
export async function syncQueue(): Promise<{ synced: number; failed: number }> {
  if (syncing || !navigator.onLine) return { synced: 0, failed: 0 };
  syncing = true;
  let synced = 0;
  let failed = 0;
  try {
    for (const item of await listQueue()) {
      const form = new FormData();
      form.set("clientRef", item.id);
      form.set("inspectionId", item.inspectionId);
      form.set("payload", JSON.stringify(item.payload));
      for (const img of item.images) {
        form.append("images", img.blob, `${img.id}.jpg`);
        form.append("imageIds", img.id);
        form.append("captions", img.caption);
      }
      let res: Response;
      try {
        res = await fetch("/api/sync/findings", { method: "POST", body: form, credentials: "same-origin" });
      } catch {
        break; // offline – später erneut
      }
      if (res.ok) {
        await removeFromQueue(item.id);
        synced++;
      } else if (res.status === 401) {
        break; // Sitzung abgelaufen – nach erneuter Anmeldung weiter
      } else {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        const current = await get<QueuedFinding>(item.id, store());
        if (current) await set(item.id, { ...current, state: "error", error: body.error ?? `Fehler ${res.status}` }, store());
        failed++;
        notify();
      }
    }
  } finally {
    syncing = false;
  }
  return { synced, failed };
}
