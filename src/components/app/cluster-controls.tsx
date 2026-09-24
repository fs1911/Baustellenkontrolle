"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { recomputeAction, setClusterStatusAction } from "@/app/(app)/wiederkehrend/actions";

export function RecomputeButton() {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <Button
      variant="outline"
      loading={pending}
      onClick={() =>
        start(async () => {
          const r = await recomputeAction();
          toast(r.ok ? (r.message ?? "OK") : r.error, r.ok ? "success" : "error");
        })
      }
    >
      <RefreshCw className="size-5" aria-hidden /> Neu berechnen
    </Button>
  );
}

export function ClusterStatusButtons({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const set = (s: "active" | "acknowledged" | "resolved") =>
    start(async () => {
      const r = await setClusterStatusAction(id, s);
      toast(r.ok ? (r.message ?? "OK") : r.error, r.ok ? "success" : "error");
    });
  return (
    <div className="flex flex-wrap gap-2">
      {status !== "acknowledged" && (
        <Button size="sm" variant="outline" loading={pending} onClick={() => set("acknowledged")}>
          Als bearbeitet markieren
        </Button>
      )}
      {status !== "resolved" && (
        <Button size="sm" variant="outline" loading={pending} onClick={() => set("resolved")}>
          Als gelöst markieren
        </Button>
      )}
      {status !== "active" && (
        <Button size="sm" variant="ghost" loading={pending} onClick={() => set("active")}>
          Wieder aktiv
        </Button>
      )}
    </div>
  );
}
