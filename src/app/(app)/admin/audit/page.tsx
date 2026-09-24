import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";
import { formatDateTime } from "@/lib/utils/format";
import { PageHeader } from "@/components/ui/feedback";
import { Table, THead, Th, Td } from "@/components/ui/table";
import { FilterBar, FilterInput, FilterSelect, param } from "@/components/app/filter-bar";

export const metadata: Metadata = { title: "Audit-Log" };

const ACTIONS: Record<string, string> = {
  insert: "Erstellt", update: "Geändert", delete: "Gelöscht", soft_delete: "Gelöscht (Soft)", release: "Freigegeben", send: "Versendet",
  send_failed: "Versand fehlgeschlagen", login: "Anmeldung", export: "Export", download: "Download", recompute: "Neuberechnung", retention_run: "Löschlauf", seed: "Demo-Daten",
};

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  const user = await requireAdmin();
  const sp = await searchParams;
  const entity = param(sp, "objekt");
  const action = param(sp, "aktion");
  const q = param(sp, "q");
  const { rows, entities } = await withUser(user.id, async (tx) => ({
    rows: await tx<{ id: number; occurredAt: Date; actorName: string | null; entityType: string; entityId: string | null; action: string; changes: unknown; context: unknown }[]>`
      select a.id, a.occurred_at, p.full_name as actor_name, a.entity_type, a.entity_id, a.action, a.changes, a.context
      from public.audit_logs a left join public.user_profiles p on p.id = a.actor_id
      where true ${entity ? tx`and a.entity_type = ${entity}` : tx``} ${action ? tx`and a.action = ${action}` : tx``}
        ${q ? tx`and (a.entity_id = ${q} or p.full_name ilike ${"%" + q + "%"})` : tx``}
      order by a.id desc limit 300`,
    entities: await tx<{ entityType: string }[]>`select distinct entity_type from public.audit_logs order by 1`,
  }));
  return (
    <>
      <PageHeader title="Audit-Log" description="Unveränderliches Protokoll: Erstellung, Änderung, Löschung, Freigabe, Versand, Anmeldung, Export (max. 300 Einträge angezeigt)." />
      <FilterBar resetHref="/admin/audit" defaultOpen={!!(entity || action || q)}>
        <FilterSelect name="objekt" label="Objekt" value={entity} options={entities.map((e) => ({ value: e.entityType, label: e.entityType }))} />
        <FilterSelect name="aktion" label="Aktion" value={action} options={Object.entries(ACTIONS).map(([v, l]) => ({ value: v, label: l }))} />
        <FilterInput name="q" label="Objekt-ID oder Person" value={q} />
      </FilterBar>
      <Table caption="Audit-Log">
        <THead><tr><Th>Zeitpunkt</Th><Th>Person</Th><Th>Aktion</Th><Th>Objekt</Th><Th>Details</Th></tr></THead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <Td className="whitespace-nowrap">{formatDateTime(r.occurredAt)}</Td>
              <Td>{r.actorName ?? "System"}</Td>
              <Td>{ACTIONS[r.action] ?? r.action}</Td>
              <Td>{r.entityType}<span className="block font-mono text-xs text-ink-muted">{r.entityId}</span></Td>
              <Td><details><summary className="cursor-pointer text-info">anzeigen</summary><pre className="mt-1 max-w-xl overflow-x-auto rounded bg-slate-50 p-2 text-xs">{JSON.stringify(r.changes ?? r.context, null, 2)}</pre></details></Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
