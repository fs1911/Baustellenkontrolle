import type { Metadata } from "next";
import { ListChecks } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";
import { listActions } from "@/lib/repositories/actions";
import { canEditSite } from "@/lib/domain/permissions";
import { ACTION_STATUSES, ACTION_STATUS_LABEL } from "@/lib/domain/enums";
import { storage } from "@/lib/services/storage";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { enumParam, FilterBar, FilterSelect, param, uuidParam } from "@/components/app/filter-bar";
import { ActionCard, type ActionCardData } from "@/components/app/action-card";

export const metadata: Metadata = { title: "Massnahmen" };

export default async function ActionsPage({ searchParams }: PageProps<"/massnahmen">) {
  const user = await requireUser();
  const sp = await searchParams;
  const statusParam = param(sp, "status");
  const f = {
    open: statusParam === "offen" || statusParam === undefined,
    status: enumParam(sp, "status", ACTION_STATUSES),
    overdue: param(sp, "ueberfaellig") === "1",
    siteId: uuidParam(sp, "baustelle"),
  };
  const { rows, sites } = await withUser(user.id, async (tx) => ({
    rows: await listActions(tx, { ...f, open: f.open && !f.status && statusParam !== "alle" }),
    sites: await tx<{ id: string; name: string }[]>`select id, name from public.construction_sites where deleted_at is null order by name`,
  }));
  const cards: ActionCardData[] = await Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      findingId: r.findingId,
      inspectionId: r.inspectionId,
      siteName: r.siteName,
      companyName: r.companyName,
      findingTitle: r.findingTitle,
      description: r.description,
      responsible: [r.responsibleRole, r.responsiblePerson].filter(Boolean).join(" – ") || null,
      dueDate: r.dueDate,
      status: r.status,
      riskLevel: r.riskLevel,
      overdue: r.overdue,
      updates: await Promise.all(
        r.updates.map(async (u) => ({
          id: u.id,
          comment: u.comment,
          statusFrom: u.statusFrom,
          statusTo: u.statusTo,
          createdAt: new Date(u.createdAt).toISOString(),
          authorName: u.authorName,
          attachments: await Promise.all(
            u.attachments.map(async (at) => ({
              id: at.id,
              fileName: at.fileName,
              url: await storage().signedUrl("attachments", at.storagePath),
            })),
          ),
        })),
      ),
    })),
  );
  const siteOf = new Map(rows.map((r) => [r.id, r.siteId]));
  return (
    <>
      <PageHeader title="Massnahmen" description={`${rows.length} Massnahme(n) · ${rows.filter((r) => r.overdue).length} überfällig`} />
      <FilterBar resetHref="/massnahmen" defaultOpen={!!(f.status || f.overdue || f.siteId)}>
        <FilterSelect
          name="status"
          label="Status"
          value={statusParam ?? "offen"}
          options={[
            { value: "offen", label: "Offen und in Bearbeitung" },
            { value: "alle", label: "Alle" },
            ...ACTION_STATUSES.map((s) => ({ value: s, label: ACTION_STATUS_LABEL[s] })),
          ]}
        />
        <FilterSelect
          name="ueberfaellig"
          label="Nur überfällige"
          value={f.overdue ? "1" : undefined}
          options={[{ value: "1", label: "Ja" }]}
        />
        <FilterSelect name="baustelle" label="Baustelle" value={f.siteId} options={sites.map((s) => ({ value: s.id, label: s.name }))} />
      </FilterBar>
      {cards.length === 0 ? (
        <EmptyState
          icon={<ListChecks className="size-12" aria-hidden />}
          title="Keine Massnahmen"
          description="Für die gewählten Filter sind keine Massnahmen vorhanden – gut so."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {cards.map((c) => (
            <ActionCard key={c.id} a={c} canVerify={canEditSite(user.permissions, siteOf.get(c.id)!)} />
          ))}
        </div>
      )}
    </>
  );
}
