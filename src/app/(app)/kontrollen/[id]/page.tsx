import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Camera, ChevronLeft, FileText, ImageIcon, Pencil, Plus, Repeat, Zap } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";
import { formatSiteAddress, getInspection } from "@/lib/repositories/inspections";
import { listFindingsForInspection, signFindingImages } from "@/lib/repositories/findings";
import { canEditSite } from "@/lib/domain/permissions";
import { INSPECTION_TYPE_LABEL } from "@/lib/domain/enums";
import { formatDate, formatDateTime, isOverdue } from "@/lib/utils/format";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, KeyValue, PageHeader } from "@/components/ui/feedback";
import { ActionStatusBadge, AssessmentBadge, InspectionStatusBadge, ReportStatusBadge, RiskBadge, Tag } from "@/components/ui/badges";
import { InspectionStatusActions } from "@/components/app/inspection-actions";

export const metadata: Metadata = { title: "Kontrolle" };

export default async function InspectionDetailPage({ params }: PageProps<"/kontrollen/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await requireUser();
  const data = await withUser(user.id, async (tx) => {
    const inspection = await getInspection(tx, id);
    if (!inspection) return null;
    const findings = await listFindingsForInspection(tx, id);
    const recurring = await tx<{ findingId: string; score: number; title: string }[]>`
      select m.finding_id, max(c.score)::float as score, (array_agg(c.title order by c.score desc))[1] as title
      from public.recurring_issue_cluster_members m join public.recurring_issue_clusters c on c.id = m.cluster_id
      where m.finding_id = any(${findings.map((f) => f.id)}::uuid[]) and c.scope = 'site'
      group by m.finding_id`;
    return { inspection, findings, recurring };
  });
  if (!data) notFound();
  const { inspection: i, findings } = data;
  const recurring = new Map(data.recurring.map((r) => [r.findingId, r]));
  const thumbs = await signFindingImages(findings);
  const editable = canEditSite(user.permissions, i.siteId);
  const counts = {
    positive: findings.filter((f) => f.assessment === "positive").length,
    negative: findings.filter((f) => f.assessment === "negative").length,
    improvement: findings.filter((f) => f.assessment === "improvement").length,
  };

  return (
    <>
      <PageHeader
        back={<Link href="/kontrollen" className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-ink-muted hover:text-ink"><ChevronLeft className="size-4" aria-hidden /> Kontrollen</Link>}
        title={i.site.name}
        description={<span className="flex flex-wrap items-center gap-2">{i.company.name} · {formatDateTime(i.inspectedAt)} · {INSPECTION_TYPE_LABEL[i.inspectionType]} <InspectionStatusBadge value={i.status} />{i.report && <ReportStatusBadge value={i.report.status} />}</span>}
        actions={<>
          <ButtonLink href={`/kontrollen/${i.id}/bericht`} variant="secondary"><FileText className="size-5" aria-hidden /> Bericht</ButtonLink>
          {editable && <ButtonLink href={`/kontrollen/${i.id}/bearbeiten`} variant="outline"><Pencil className="size-5" aria-hidden /> Bearbeiten</ButtonLink>}
          {editable && <InspectionStatusActions id={i.id} status={i.status} canDelete={user.permissions.manageable_company_ids.includes(i.companyId)} />}
        </>}
      />

      {editable && (
        <div className="mb-5 grid grid-cols-2 gap-3">
          <ButtonLink href={`/kontrollen/${i.id}/feststellungen/neu`} size="xl" className="w-full px-2 text-lg sm:text-xl"><Plus className="size-6 shrink-0" aria-hidden /> Feststellung</ButtonLink>
          <ButtonLink href={`/kontrollen/${i.id}/schnellerfassung`} size="xl" variant="secondary" className="w-full px-2 text-lg sm:text-xl"><Zap className="size-6 shrink-0" aria-hidden /> Schnell<ButtonLink href={`/kontrollen/${i.id}/schnellerfassung`} size="xl" variant="secondary" className="w-full"><Zap className="size-6" aria-hidden /> Schnellerfassung</ButtonLink>shy;erfassung</ButtonLink>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-auto text-xl font-bold">Feststellungen ({findings.length})</h2>
            <Tag className="text-positive">{counts.positive} positiv</Tag>
            <Tag className="text-negative">{counts.negative} Abweichung(en)</Tag>
            <Tag className="text-improve">{counts.improvement} Verbesserung(en)</Tag>
          </div>
          {findings.length === 0 ? (
            <EmptyState icon={<Camera className="size-12" aria-hidden />} title="Noch keine Feststellungen"
              description="Erfassen Sie positive Beobachtungen, Abweichungen und Verbesserungsmöglichkeiten – direkt mit Foto."
              action={editable && <ButtonLink href={`/kontrollen/${i.id}/feststellungen/neu`}><Plus className="size-5" aria-hidden /> Erste Feststellung erfassen</ButtonLink>} />
          ) : (
            <ol className="space-y-3">
              {findings.map((f) => {
                const action = f.actions[0];
                const overdue = action ? isOverdue(action.dueDate, action.status) : false;
                const rec = recurring.get(f.id);
                const href = editable ? `/kontrollen/${i.id}/feststellungen/${f.id}` : `/kontrollen/${i.id}/feststellungen/${f.id}`;
                return (
                  <li key={f.id}>
                    <Link href={href} className="flex gap-3 rounded-[var(--radius-card)] border border-line bg-white p-3 shadow-[var(--shadow-card)] hover:border-line-strong sm:p-4">
                      <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 sm:size-24">
                        {f.images[0] ? (
                          <Image src={thumbs.get(f.images[0].id)!} alt={f.images[0].caption ?? `Foto zu ${f.title}`} width={96} height={96} unoptimized className="size-full object-cover" />
                        ) : (
                          <ImageIcon className="size-8 text-ink-subtle" aria-label="Kein Foto" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <p className="font-semibold"><span className="text-ink-muted">{f.number}.</span> {f.title}</p>
                        <div className="flex flex-wrap gap-1.5">
                          <AssessmentBadge value={f.assessment} />
                          <RiskBadge value={f.riskLevel} />
                          <ActionStatusBadge value={f.status} overdue={overdue} />
                          {rec && <Tag className="border-violet-300 bg-violet-50 text-violet-800"><Repeat className="size-4" aria-hidden /> Wiederkehrend · Score {rec.score}</Tag>}
                        </div>
                        <p className="text-sm text-ink-muted">{[f.categoryName, f.subcategoryName].filter(Boolean).join(" / ") || "Ohne Kategorie"}</p>
                        {action && <p className="line-clamp-2 text-sm"><span className="font-semibold">Massnahme:</span> {action.description}{action.dueDate && <> · Frist {formatDate(action.dueDate)}</>}</p>}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <Card className="h-fit">
          <CardHeader title="Angaben" />
          <CardBody>
            <KeyValue items={[
              { label: "Gesellschaft", value: i.company.name },
              { label: "Baustelle / Projekt", value: `${i.site.name}${i.site.projectName && i.site.projectName !== i.site.name ? ` (${i.site.projectName})` : ""}` },
              { label: "Baustellen-/Projektnummer", value: i.site.siteNumber },
              { label: "Adresse", value: formatSiteAddress(i.site) },
              { label: "Datum / Uhrzeit", value: formatDateTime(i.inspectedAt) },
              { label: "Kontrolltyp", value: INSPECTION_TYPE_LABEL[i.inspectionType] },
              { label: "Kontrollierende Person", value: i.inspectorName },
              { label: "Anwesende", value: i.participants.map((p) => [p.fullName, p.functionLabel].filter(Boolean).join(", ")).join("; ") },
              { label: "Wetter", value: i.weather },
              { label: "Bereich / Gewerk", value: i.area },
            ]} />
            {i.notes && <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm">{i.notes}</p>}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
