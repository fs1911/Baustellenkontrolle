"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import { listQueue, QUEUE_EVENT, syncQueue } from "@/lib/offline/queue";
import { useToast } from "@/components/ui/toast";

/** Zeigt Offline-Status und ausstehende Synchronisationen; registriert den Service Worker. */
export function ConnectivityBanner() {
  const online = useSyncExternalStore(
    (cb) => {
      window.addEventListener("online", cb);
      window.addEventListener("offline", cb);
      return () => {
        window.removeEventListener("online", cb);
        window.removeEventListener("offline", cb);
      };
    },
    () => navigator.onLine,
    () => true,
  );
  const [pending, setPending] = useState(0);
  const [errors, setErrors] = useState(0);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const refresh = useCallback(async () => {
    const q = await listQueue().catch(() => []);
    setPending(q.length);
    setErrors(q.filter((i) => i.state === "error").length);
  }, []);

  const runSync = useCallback(async () => {
    setBusy(true);
    const r = await syncQueue();
    setBusy(false);
    await refresh();
    if (r.synced > 0) toast(`${r.synced} offline erfasste Feststellung(en) synchronisiert.`);
    if (r.failed > 0) toast(`${r.failed} Erfassung(en) konnten nicht übertragen werden.`, "error");
  }, [refresh, toast]);

  useEffect(() => {
    const on = () => void runSync();
    const changed = () => void refresh();
    window.addEventListener("online", on);
    window.addEventListener(QUEUE_EVENT, changed);
    // Erstabgleich asynchron nach dem Rendern (IndexedDB ist ein externes System)
    const initial = setTimeout(() => {
      void refresh().then(() => {
        if (navigator.onLine) void runSync();
      });
    }, 0);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    return () => {
      clearTimeout(initial);
      window.removeEventListener("online", on);
      window.removeEventListener(QUEUE_EVENT, changed);
    };
  }, [refresh, runSync]);

  if (online && pending === 0) return null;
  return (
    <div
      className="no-print bg-improve flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm font-semibold text-white"
      role="status"
    >
      <span className="flex items-center gap-2">
        {!online && <CloudOff className="size-5" aria-hidden />}
        {!online
          ? "Offline – neue Erfassungen werden auf dem Gerät gespeichert."
          : `${pending} Erfassung(en) warten auf Synchronisation${errors ? ` (${errors} mit Fehler)` : ""}.`}
      </span>
      {online && pending > 0 && (
        <button
          type="button"
          onClick={runSync}
          disabled={busy}
          className="inline-flex min-h-10 items-center gap-2 rounded-md bg-white/20 px-3 hover:bg-white/30"
        >
          <RefreshCw className={busy ? "size-4 animate-spin" : "size-4"} aria-hidden /> Jetzt synchronisieren
        </button>
      )}
    </div>
  );
}
