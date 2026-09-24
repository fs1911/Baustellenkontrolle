"use client";

import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { RetryButton } from "./report-workspace";
import { retryDeliveryAction } from "@/app/(app)/kontrollen/[id]/bericht/actions";

export function DeliveryRetry({ deliveryId, inspectionId }: { deliveryId: string; inspectionId: string }) {
  const toast = useToast();
  const router = useRouter();
  return (
    <RetryButton
      onRetry={async () => {
        const r = await retryDeliveryAction(deliveryId, inspectionId);
        toast(r.ok ? (r.message ?? "Gesendet.") : r.error, r.ok ? "success" : "error");
        router.refresh();
      }}
    />
  );
}
