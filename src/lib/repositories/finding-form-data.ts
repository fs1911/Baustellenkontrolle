import "server-only";
import type { Tx } from "@/lib/db/client";
import { listCategories, listReferences } from "./catalog";
import type { CatalogOption, ReferenceOption } from "@/components/forms/finding-form";

/** Katalog- und Referenzdaten für das Feststellungsformular. */
export async function loadFindingFormData(tx: Tx): Promise<{ catalog: CatalogOption[]; references: ReferenceOption[] }> {
  const { categories, subcategories } = await listCategories(tx);
  const mappings = await tx<{ categoryId: string; legalReferenceId: string }[]>`
    select category_id, legal_reference_id from public.category_reference_mappings`;
  const refs = await listReferences(tx);
  return {
    catalog: categories.map((c) => ({
      id: c.id,
      name: c.name,
      sampleAction: c.sampleAction,
      referenceIds: mappings.filter((m) => m.categoryId === c.id).map((m) => m.legalReferenceId),
      subcategories: subcategories
        .filter((s) => s.categoryId === c.id)
        .map((s) => ({ id: s.id, name: s.name, sampleAction: s.sampleAction })),
    })),
    references: refs
      .filter((r) => r.reviewStatus !== "retired")
      .map((r) => ({ id: r.id, code: r.code, title: r.title, referenceType: r.referenceType, reviewStatus: r.reviewStatus })),
  };
}
