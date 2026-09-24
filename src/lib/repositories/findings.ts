import "server-only";
import type { Tx } from "@/lib/db/client";
import type { ActionStatus, Assessment, ReferenceType, ReviewStatus, RiskLevel } from "@/lib/domain/enums";
import { storage } from "@/lib/services/storage";

export interface FindingImage {
  id: string;
  storagePath: string;
  thumbnailPath: string | null;
  caption: string | null;
  width: number | null;
  height: number | null;
  sortOrder: number;
}

export interface FindingAction {
  id: string;
  description: string;
  responsibleRole: string | null;
  responsiblePerson: string | null;
  responsibleUserId: string | null;
  dueDate: string | null;
  status: ActionStatus;
  completedAt: Date | null;
  completionNote: string | null;
  verifiedAt: Date | null;
  verifiedByName: string | null;
  verificationNote: string | null;
}

export interface FindingReference {
  id: string;
  referenceType: ReferenceType;
  code: string;
  title: string;
  url: string | null;
  reviewStatus: ReviewStatus;
  suggestedByAi: boolean;
}

export interface FindingRow {
  id: string;
  inspectionId: string;
  companyId: string;
  siteId: string;
  number: number;
  title: string;
  description: string | null;
  assessment: Assessment;
  categoryId: string | null;
  categoryName: string | null;
  subcategoryId: string | null;
  subcategoryName: string | null;
  riskLevel: RiskLevel | null;
  trade: string | null;
  location: string | null;
  responsibleRole: string | null;
  status: ActionStatus | null;
  referenceNote: string | null;
  closedAt: Date | null;
  closureNote: string | null;
  createdAt: Date;
  createdByName: string | null;
  actions: FindingAction[];
  images: FindingImage[];
  references: FindingReference[];
}

async function hydrate(tx: Tx, rows: Omit<FindingRow, "actions" | "images" | "references">[]): Promise<FindingRow[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const actions = await tx<(FindingAction & { findingId: string })[]>`
    select a.id, a.finding_id, a.description, a.responsible_role, a.responsible_person, a.responsible_user_id,
           a.due_date::text as due_date, a.status, a.completed_at, a.completion_note, a.verified_at,
           v.full_name as verified_by_name, a.verification_note
    from public.corrective_actions a left join public.user_profiles v on v.id = a.verified_by
    where a.finding_id = any(${ids}::uuid[]) order by a.created_at`;
  const images = await tx<(FindingImage & { findingId: string })[]>`
    select id, finding_id, storage_path, thumbnail_path, caption, width, height, sort_order
    from public.finding_images where finding_id = any(${ids}::uuid[]) and deleted_at is null order by sort_order, created_at`;
  const refs = await tx<(FindingReference & { findingId: string })[]>`
    select r.id, fr.finding_id, r.reference_type, r.code, r.title, r.url, r.review_status, fr.suggested_by_ai
    from public.finding_references fr join public.legal_references r on r.id = fr.legal_reference_id
    where fr.finding_id = any(${ids}::uuid[]) order by r.reference_type, r.code`;
  return rows.map((r) => ({
    ...r,
    actions: actions.filter((a) => a.findingId === r.id),
    images: images.filter((i) => i.findingId === r.id),
    references: refs.filter((x) => x.findingId === r.id),
  }));
}

const baseSelect = (tx: Tx) => tx`
  select f.id, f.inspection_id, f.company_id, f.site_id, f.number, f.title, f.description, f.assessment, f.category_id,
         cat.name as category_name, f.subcategory_id, sub.name as subcategory_name, f.risk_level, f.trade, f.location,
         f.responsible_role, f.status, f.reference_note, f.closed_at, f.closure_note, f.created_at, p.full_name as created_by_name
  from public.findings f
  left join public.finding_categories cat on cat.id = f.category_id
  left join public.finding_subcategories sub on sub.id = f.subcategory_id
  left join public.user_profiles p on p.id = f.created_by`;

export async function listFindingsForInspection(tx: Tx, inspectionId: string): Promise<FindingRow[]> {
  const rows = await tx<Omit<FindingRow, "actions" | "images" | "references">[]>`
    ${baseSelect(tx)} where f.inspection_id = ${inspectionId} and f.deleted_at is null order by f.number`;
  return hydrate(tx, rows);
}

export async function getFinding(tx: Tx, id: string): Promise<FindingRow | null> {
  const rows = await tx<Omit<FindingRow, "actions" | "images" | "references">[]>`
    ${baseSelect(tx)} where f.id = ${id} and f.deleted_at is null`;
  const [row] = await hydrate(tx, rows);
  return row ?? null;
}

export interface FindingSearchFilters {
  companyId?: string;
  siteId?: string;
  categoryId?: string;
  subcategoryId?: string;
  assessment?: Assessment;
  riskLevel?: RiskLevel;
  status?: ActionStatus;
  responsibleRole?: string;
  inspectorId?: string;
  from?: string;
  to?: string;
  q?: string;
  overdue?: boolean;
  ids?: string[];
}

export interface FindingSearchRow {
  id: string;
  inspectionId: string;
  number: number;
  title: string;
  assessment: Assessment;
  riskLevel: RiskLevel | null;
  status: ActionStatus | null;
  categoryName: string | null;
  subcategoryName: string | null;
  siteName: string;
  companyName: string;
  createdAt: Date;
  dueDate: string | null;
  overdue: boolean;
}

export async function searchFindings(tx: Tx, f: FindingSearchFilters, limit = 300): Promise<FindingSearchRow[]> {
  const q = f.q?.trim() || null;
  return tx<FindingSearchRow[]>`
    select f.id, f.inspection_id, f.number, f.title, f.assessment, f.risk_level, f.status, cat.name as category_name,
           sub.name as subcategory_name, s.name as site_name, c.name as company_name, f.created_at,
           (select min(a.due_date)::text from public.corrective_actions a where a.finding_id = f.id and a.status in ('open','in_progress')) as due_date,
           exists (select 1 from public.corrective_actions a where a.finding_id = f.id and a.status in ('open','in_progress')
                   and a.due_date < (now() at time zone 'Europe/Zurich')::date) as overdue
    from public.findings f
    join public.inspections i on i.id = f.inspection_id and i.deleted_at is null
    join public.construction_sites s on s.id = f.site_id
    join public.companies c on c.id = f.company_id
    left join public.finding_categories cat on cat.id = f.category_id
    left join public.finding_subcategories sub on sub.id = f.subcategory_id
    where f.deleted_at is null
      ${f.companyId ? tx`and f.company_id = ${f.companyId}` : tx``}
      ${f.siteId ? tx`and f.site_id = ${f.siteId}` : tx``}
      ${f.categoryId ? tx`and f.category_id = ${f.categoryId}` : tx``}
      ${f.subcategoryId ? tx`and f.subcategory_id = ${f.subcategoryId}` : tx``}
      ${f.assessment ? tx`and f.assessment = ${f.assessment}` : tx``}
      ${f.riskLevel ? tx`and f.risk_level = ${f.riskLevel}` : tx``}
      ${f.status ? tx`and f.status = ${f.status}` : tx``}
      ${f.responsibleRole ? tx`and f.responsible_role ilike ${f.responsibleRole}` : tx``}
      ${f.inspectorId ? tx`and i.inspector_id = ${f.inspectorId}` : tx``}
      ${f.from ? tx`and i.inspected_at >= ${f.from}::date` : tx``}
      ${f.to ? tx`and i.inspected_at < ${f.to}::date + 1` : tx``}
      ${f.ids?.length ? tx`and f.id = any(${f.ids}::uuid[])` : tx``}
      ${q ? tx`and (f.search_text @@ websearch_to_tsquery('german', ${q}) or f.title ilike ${"%" + q + "%"})` : tx``}
      ${f.overdue ? tx`and exists (select 1 from public.corrective_actions a where a.finding_id = f.id and a.status in ('open','in_progress') and a.due_date < (now() at time zone 'Europe/Zurich')::date)` : tx``}
    order by f.created_at desc
    limit ${limit}`;
}

export interface SimilarFinding {
  id: string;
  inspectionId: string;
  title: string;
  assessment: Assessment;
  riskLevel: RiskLevel | null;
  status: ActionStatus | null;
  siteName: string;
  createdAt: Date;
  similarity: number;
  sameCategory: boolean;
  sameSite: boolean;
  actionDescription: string | null;
}

/**
 * Ähnliche frühere Feststellungen (RLS-gefiltert): Trigramm-Ähnlichkeit (pg_trgm) auf Titel/Beschreibung
 * plus Bonus für gleiche Kategorie. Kriterien werden in der UI offen ausgewiesen.
 */
export async function findSimilar(
  tx: Tx,
  input: { text: string; categoryId?: string | null; siteId?: string | null; excludeId?: string | null },
  limit = 5,
): Promise<SimilarFinding[]> {
  if (input.text.trim().length < 4) return [];
  return tx<SimilarFinding[]>`
    select * from (
      select f.id, f.inspection_id, f.title, f.assessment, f.risk_level, f.status, s.name as site_name, f.created_at,
             round(extensions.similarity(f.title || ' ' || coalesce(f.description, ''), ${input.text})::numeric, 3)::float as similarity,
             coalesce(f.category_id = ${input.categoryId ?? null}::uuid, false) as same_category,
             coalesce(f.site_id = ${input.siteId ?? null}::uuid, false) as same_site,
             (select a.description from public.corrective_actions a where a.finding_id = f.id order by a.created_at limit 1) as action_description
      from public.findings f
      join public.construction_sites s on s.id = f.site_id
      where f.deleted_at is null and f.id <> coalesce(${input.excludeId ?? null}::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
    ) x
    where x.similarity >= 0.12 or (x.same_category and x.similarity >= 0.06)
    order by (x.similarity + case when x.same_category then 0.15 else 0 end) desc, x.created_at desc
    limit ${limit}`;
}

/** Signierte URLs (Bilder) – nur für Datensätze, die zuvor per RLS gelesen wurden. */
export async function signFindingImages<T extends { images: FindingImage[] }>(rows: T[], useThumbnail = true) {
  const urls = new Map<string, string>();
  for (const row of rows) {
    for (const img of row.images) {
      const path = useThumbnail && img.thumbnailPath ? img.thumbnailPath : img.storagePath;
      urls.set(img.id, await storage().signedUrl("finding-images", path));
    }
  }
  return urls;
}
