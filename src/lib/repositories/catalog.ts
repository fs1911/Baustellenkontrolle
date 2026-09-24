import "server-only";
import type { Tx } from "@/lib/db/client";
import type { CatalogCategory } from "@/lib/domain/classifier";
import type { ReferenceType, ReviewStatus, RiskLevel } from "@/lib/domain/enums";

export interface CategoryRow {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  description: string | null;
  defaultRisk: RiskLevel;
  keywords: string[];
  internalRule: string | null;
  sampleAction: string | null;
  isActive: boolean;
}
export interface SubcategoryRow {
  id: string;
  categoryId: string;
  code: string;
  name: string;
  defaultRisk: RiskLevel | null;
  keywords: string[];
  sampleAction: string | null;
  isActive: boolean;
  sortOrder: number;
}
export interface ReferenceRow {
  id: string;
  referenceType: ReferenceType;
  code: string;
  title: string;
  description: string | null;
  url: string | null;
  source: string | null;
  retrievedAt: string | null;
  sourceVersion: string | null;
  versionNo: number;
  supersedesId: string | null;
  reviewStatus: ReviewStatus;
  reviewedAt: Date | null;
  reviewerName: string | null;
  reviewNote: string | null;
  isActive: boolean;
  updatedAt: Date;
}

export async function listCategories(tx: Tx, onlyActive = true) {
  const categories = await tx<CategoryRow[]>`
    select id, code, name, sort_order, description, default_risk, keywords, internal_rule, sample_action, is_active
    from public.finding_categories ${onlyActive ? tx`where is_active` : tx``} order by sort_order`;
  const subcategories = await tx<SubcategoryRow[]>`
    select id, category_id, code, name, default_risk, keywords, sample_action, is_active, sort_order
    from public.finding_subcategories ${onlyActive ? tx`where is_active` : tx``} order by sort_order, name`;
  return { categories, subcategories };
}

export async function listReferences(tx: Tx, opts: { includeInactive?: boolean } = {}) {
  return tx<ReferenceRow[]>`
    select r.id, r.reference_type, r.code, r.title, r.description, r.url, r.source, r.retrieved_at::text as retrieved_at,
           r.source_version, r.version_no, r.supersedes_id, r.review_status, r.reviewed_at, p.full_name as reviewer_name,
           r.review_note, r.is_active, r.updated_at
    from public.legal_references r
    left join public.user_profiles p on p.id = r.reviewed_by
    ${opts.includeInactive ? tx`` : tx`where r.is_active`}
    order by r.reference_type, r.code`;
}

export async function listMappings(tx: Tx) {
  return tx<{ id: string; categoryId: string; subcategoryId: string | null; legalReferenceId: string }[]>`
    select id, category_id, subcategory_id, legal_reference_id from public.category_reference_mappings`;
}

/** Katalog im Format des Klassifikators inkl. verknüpfter, aktiver Referenzen. */
export async function loadClassifierCatalog(tx: Tx): Promise<CatalogCategory[]> {
  const { categories, subcategories } = await listCategories(tx);
  const mappings = await tx<{ categoryId: string; legalReferenceId: string }[]>`
    select m.category_id, m.legal_reference_id from public.category_reference_mappings m
    join public.legal_references r on r.id = m.legal_reference_id and r.is_active and r.review_status <> 'retired'`;
  return categories.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    keywords: c.keywords,
    defaultRisk: c.defaultRisk,
    sampleAction: c.sampleAction,
    referenceIds: mappings.filter((m) => m.categoryId === c.id).map((m) => m.legalReferenceId),
    subcategories: subcategories
      .filter((s) => s.categoryId === c.id)
      .map((s) => ({ id: s.id, code: s.code, name: s.name, keywords: s.keywords, defaultRisk: s.defaultRisk, sampleAction: s.sampleAction })),
  }));
}
