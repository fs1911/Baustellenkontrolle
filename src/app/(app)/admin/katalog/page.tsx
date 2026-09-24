import type { Metadata } from "next";
import { requireCatalogEditor } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";
import { listCategories, listMappings, listReferences } from "@/lib/repositories/catalog";
import { REFERENCE_TYPE_LABEL, RISK_LABEL } from "@/lib/domain/enums";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert, PageHeader } from "@/components/ui/feedback";
import { ReviewStatusBadge, Tag } from "@/components/ui/badges";
import { CategoryEditor, ReferenceEditor, ReviewButtons, SubcategoryEditor } from "@/components/admin/catalog-editors";

export const metadata: Metadata = { title: "Kategorien und Referenzkatalog" };

export default async function CatalogPage() {
  const user = await requireCatalogEditor();
  const d = await withUser(user.id, async (tx) => ({
    ...(await listCategories(tx, false)),
    references: await listReferences(tx, { includeInactive: true }),
    mappings: await listMappings(tx),
  }));
  const cats = d.categories.map((c) => ({ id: c.id, name: c.name }));
  const toReview = d.references.filter((r) => r.isActive && r.reviewStatus === "to_review").length;
  return (
    <>
      <PageHeader title="Kategorien und Referenzkatalog" description="Referenzen sind Orientierungshilfen, keine rechtsverbindliche oder vollständige Rechtsdatenbank." />
      <Alert tone="warning" title={`${toReview} Referenz(en) mit Status «zu prüfen»`} className="mb-5">
        Initiale Einträge wurden ohne verifizierte Artikel-/Dokumentnummern und ohne Links angelegt. Bitte durch das IMS-/SIBE-Team prüfen, ergänzen (Fundstelle, Link, Version, Abrufdatum) und freigeben. In Berichten werden ungeprüfte Referenzen mit «(Zu prüfen)» gekennzeichnet.
      </Alert>

      <h2 className="mb-3 text-xl font-bold">Kategorien ({d.categories.length})</h2>
      <div className="mb-8 space-y-3">
        {d.categories.map((c) => {
          const subs = d.subcategories.filter((s) => s.categoryId === c.id);
          return (
            <details key={c.id} className="group rounded-[var(--radius-card)] border border-line bg-white shadow-[var(--shadow-card)]">
              <summary className="flex min-h-14 cursor-pointer list-none flex-wrap items-center gap-2 px-5">
                <span className="text-ink-muted">{c.sortOrder}.</span><span className="font-semibold">{c.name}</span>
                <Tag>{RISK_LABEL[c.defaultRisk]}</Tag><Tag>{subs.length} Unterkategorien</Tag><Tag>{d.mappings.filter((m) => m.categoryId === c.id).length} Referenzen</Tag>
                {!c.isActive && <Tag>inaktiv</Tag>}
              </summary>
              <div className="space-y-4 border-t border-line p-5">
                <CategoryEditor initial={{ id: c.id, name: c.name, description: c.description ?? "", defaultRisk: c.defaultRisk, keywords: c.keywords.join(", "), internalRule: c.internalRule ?? "", sampleAction: c.sampleAction ?? "", isActive: c.isActive }} />
                <h3 className="font-semibold">Unterkategorien</h3>
                {subs.map((s) => <SubcategoryEditor key={s.id} initial={{ id: s.id, categoryId: c.id, code: s.code, name: s.name, defaultRisk: s.defaultRisk ?? "", keywords: s.keywords.join(", "), sampleAction: s.sampleAction ?? "", isActive: s.isActive }} />)}
                <SubcategoryEditor initial={{ id: null, categoryId: c.id, code: `${c.code}.`, name: "", defaultRisk: "", keywords: "", sampleAction: "", isActive: true }} />
              </div>
            </details>
          );
        })}
      </div>

      <h2 className="mb-3 text-xl font-bold">Referenzen ({d.references.filter((r) => r.isActive).length} aktiv)</h2>
      <div className="space-y-3">
        {d.references.map((r) => (
          <details key={r.id} className={`group rounded-[var(--radius-card)] border border-line bg-white shadow-[var(--shadow-card)] ${r.isActive ? "" : "opacity-60"}`}>
            <summary className="flex min-h-14 cursor-pointer list-none flex-wrap items-center gap-2 px-5 py-2">
              <Tag>{REFERENCE_TYPE_LABEL[r.referenceType]}</Tag><span className="font-semibold">{r.code}</span><span className="text-sm text-ink-muted">{r.title}</span>
              <ReviewStatusBadge value={r.reviewStatus} /><Tag>Version {r.versionNo}</Tag>{!r.isActive && <Tag>inaktiv / ersetzt</Tag>}
            </summary>
            <div className="grid gap-5 border-t border-line p-5 lg:grid-cols-2">
              <div className="space-y-2 text-sm">
                <p>{r.description}</p>
                <p><span className="text-ink-muted">Quelle:</span> {r.source ?? "–"} · <span className="text-ink-muted">Link:</span> {r.url ? <a className="text-info underline" href={r.url} target="_blank" rel="noopener noreferrer">{r.url}</a> : "fehlt"}</p>
                <p><span className="text-ink-muted">Abrufdatum:</span> {formatDate(r.retrievedAt)} · <span className="text-ink-muted">Stand:</span> {r.sourceVersion ?? "–"}</p>
                <p><span className="text-ink-muted">Prüfung:</span> {r.reviewerName ? `${r.reviewerName}, ${formatDateTime(r.reviewedAt)}` : "ausstehend"}{r.reviewNote ? ` – ${r.reviewNote}` : ""}</p>
                <p><span className="text-ink-muted">Kategorien:</span> {d.mappings.filter((m) => m.legalReferenceId === r.id).map((m) => cats.find((c) => c.id === m.categoryId)?.name).filter(Boolean).join(", ") || "–"}</p>
                {r.isActive && <ReviewButtons id={r.id} status={r.reviewStatus} />}
              </div>
              {r.isActive && (
                <ReferenceEditor categories={cats} initial={{ id: r.id, referenceType: r.referenceType, code: r.code, title: r.title, description: r.description ?? "", url: r.url ?? "", source: r.source ?? "", retrievedAt: r.retrievedAt ?? "", sourceVersion: r.sourceVersion ?? "", categoryIds: d.mappings.filter((m) => m.legalReferenceId === r.id).map((m) => m.categoryId) }} />
              )}
            </div>
          </details>
        ))}
        <Card>
          <CardHeader title="Neue Referenz" />
          <CardBody><ReferenceEditor categories={cats} initial={{ id: null, referenceType: "internal", code: "", title: "", description: "", url: "", source: "", retrievedAt: "", sourceVersion: "", categoryIds: [] }} /></CardBody>
        </Card>
      </div>
    </>
  );
}
