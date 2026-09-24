import "server-only";
import type { Tx } from "@/lib/db/client";
import type { ActionStatus, RiskLevel } from "@/lib/domain/enums";

export interface ActionListRow {
  id: string;
  findingId: string;
  inspectionId: string;
  siteId: string;
  siteName: string;
  companyName: string;
  findingTitle: string;
  description: string;
  responsibleRole: string | null;
  responsiblePerson: string | null;
  dueDate: string | null;
  status: ActionStatus;
  riskLevel: RiskLevel | null;
  completionNote: string | null;
  overdue: boolean;
  updates: {
    id: string;
    comment: string | null;
    statusFrom: ActionStatus | null;
    statusTo: ActionStatus | null;
    createdAt: Date;
    authorName: string | null;
    attachments: { id: string; storagePath: string; fileName: string }[];
  }[];
}

export async function listActions(
  tx: Tx,
  f: { open?: boolean; overdue?: boolean; siteId?: string; status?: ActionStatus },
  limit = 200,
): Promise<ActionListRow[]> {
  const rows = await tx<Omit<ActionListRow, "updates">[]>`
    select a.id, a.finding_id, f.inspection_id, a.site_id, s.name as site_name, c.name as company_name, f.title as finding_title,
           a.description, a.responsible_role, a.responsible_person, a.due_date::text as due_date, a.status, f.risk_level, a.completion_note,
           (a.status in ('open','in_progress') and a.due_date < (now() at time zone 'Europe/Zurich')::date) as overdue
    from public.corrective_actions a join public.findings f on f.id = a.finding_id and f.deleted_at is null
    join public.inspections i on i.id = f.inspection_id and i.deleted_at is null
    join public.construction_sites s on s.id = a.site_id join public.companies c on c.id = a.company_id
    where true
      ${f.open ? tx`and a.status in ('open','in_progress')` : tx``}
      ${f.status ? tx`and a.status = ${f.status}` : tx``}
      ${f.overdue ? tx`and a.status in ('open','in_progress') and a.due_date < (now() at time zone 'Europe/Zurich')::date` : tx``}
      ${f.siteId ? tx`and a.site_id = ${f.siteId}` : tx``}
    order by (a.status in ('open','in_progress')) desc, overdue desc,
             case f.risk_level when 'critical' then 0 when 'high' then 1 when 'medium' then 2 else 3 end, a.due_date nulls last
    limit ${limit}`;
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const updates = await tx<(ActionListRow["updates"][number] & { actionId: string })[]>`
    select u.id, u.action_id, u.comment, u.status_from, u.status_to, u.created_at, p.full_name as author_name,
           coalesce((select json_agg(json_build_object('id', at.id, 'storagePath', at.storage_path, 'fileName', at.file_name))
                     from public.attachments at where at.entity_type = 'action_update' and at.entity_id = u.id and at.deleted_at is null), '[]'::json) as attachments
    from public.action_updates u left join public.user_profiles p on p.id = u.created_by
    where u.action_id = any(${ids}::uuid[]) order by u.created_at`;
  return rows.map((r) => ({ ...r, updates: updates.filter((u) => u.actionId === r.id) }));
}
