"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { deleteInspectionAction, setInspectionStatusAction } from "@/app/(app)/kontrollen/actions";

export function InspectionStatusActions({
  id,
  status,
  canDelete,
}: {
  id: string;
  status: "draft" | "completed" | "archived";
  canDelete: boolean;
}) {
  const [pending, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const run = (next: "draft" | "completed") =>
    start(async () => {
      const r = await setInspectionStatusAction(id, next);
      toast(r.ok ? (r.message ?? "Gespeichert.") : r.error, r.ok ? "success" : "error");
      router.refresh();
    });
  return (
    <>
      {status === "draft" ? (
        <Button variant="success" onClick={() => run("completed")} loading={pending}>
          <CheckCircle2 className="size-5" aria-hidden /> Kontrolle abschliessen
        </Button>
      ) : (
        <Button variant="outline" onClick={() => run("draft")} loading={pending}>
          <RotateCcw className="size-5" aria-hidden /> Wieder öffnen
        </Button>
      )}
      {canDelete && status === "draft" && (
        <Button variant="ghost" onClick={() => setConfirmDelete(true)} aria-label="Kontrolle löschen">
          <Trash2 className="size-5" aria-hidden />
        </Button>
      )}
      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Kontrolle löschen?"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Abbrechen
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() =>
                start(async () => {
                  const r = await deleteInspectionAction(id);
                  if (r && !r.ok) toast(r.error, "error");
                })
              }
            >
              Endgültig löschen
            </Button>
          </>
        }
      >
        <p>Die Kontrolle und alle Feststellungen werden als gelöscht markiert (Soft Delete, im Audit Log nachvollziehbar).</p>
      </Dialog>
    </>
  );
}
