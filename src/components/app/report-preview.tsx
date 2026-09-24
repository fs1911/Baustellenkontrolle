import type { ReportContent, ReportFinding } from "@/lib/services/reports/model";
import { AssessmentBadge, RiskBadge, ActionStatusBadge, Tag } from "@/components/ui/badges";

/** HTML-Vorschau des Berichts – gleiche Datenbasis wie das PDF. */
export function ReportPreview({
  content: c,
  logoUrl,
  imageUrls,
}: {
  content: ReportContent;
  logoUrl: string | null;
  imageUrls: Record<string, string>;
}) {
  const deviations = c.findings.filter((f) => f.assessment !== "positive");
  const positives = c.findings.filter((f) => f.assessment === "positive");
  return (
    <article
      className="border-line mx-auto max-w-[820px] space-y-6 rounded-lg border bg-white p-5 shadow-[var(--shadow-card)] sm:p-10"
      aria-label="Berichtsvorschau"
    >
      <header className="border-line space-y-4 border-b pb-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {logoUrl && <img src={logoUrl} alt={`Logo ${c.company.name}`} className="h-16 w-auto object-contain" />}
        <p className="text-ink-muted text-sm">
          {c.company.name}
          {c.company.address ? ` · ${c.company.address}` : ""}
        </p>
        <div className="border-l-8 pl-4" style={{ borderColor: c.company.primaryColor }}>
          <h2 className="text-3xl font-bold">Baustellenkontrollbericht</h2>
          <p className="text-lg">{c.inspection.siteName}</p>
        </div>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {[
            ["Bericht-ID", c.reportNumber],
            ["Version", String(c.versionNo)],
            ["Baustellen-/Projektnummer", c.inspection.siteNumber],
            ["Adresse", c.inspection.siteAddress],
            ["Kontrolltyp", c.inspection.type],
            ["Datum und Uhrzeit", c.inspection.dateTime],
            ["Kontrollperson", c.inspection.inspector],
            ["Anwesende", c.inspection.participants.join("; ") || "–"],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-ink-muted">{k}</dt>
              <dd className="font-semibold">{v || "–"}</dd>
            </div>
          ))}
        </dl>
        {c.company.confidentialityNote && <p className="text-ink-muted rounded bg-slate-50 p-2 text-xs">{c.company.confidentialityNote}</p>}
      </header>

      <section className="space-y-3">
        <h3 className="text-xl font-bold" style={{ color: c.company.primaryColor }}>
          1. Management Summary
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[
            ["Positiv", c.counts.positive],
            ["Abweichungen", c.counts.negative],
            ["Verbesserungen", c.counts.improvement],
            ["Hoch/kritisch", c.counts.criticalOrHigh],
            ["Offene Massnahmen", c.counts.openActions],
          ].map(([k, v]) => (
            <div key={k as string} className="border-line rounded border p-2">
              <p className="text-2xl font-bold">{v}</p>
              <p className="text-ink-muted text-xs">{k}</p>
            </div>
          ))}
        </div>
        {c.counts.recurring > 0 && <p className="text-sm">Wiederkehrende Abweichungshinweise: {c.counts.recurring}</p>}
        <p className="whitespace-pre-line">
          {c.summaryText || <span className="text-ink-muted italic">Noch keine Zusammenfassung erfasst.</span>}
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-xl font-bold" style={{ color: c.company.primaryColor }}>
          2. Feststellungen
        </h3>
        {deviations.length === 0 ? (
          <p className="text-ink-muted">Keine Abweichungen oder Verbesserungsmöglichkeiten.</p>
        ) : (
          deviations.map((f) => <PreviewFinding key={f.id} f={f} imageUrls={imageUrls} />)
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-xl font-bold" style={{ color: c.company.primaryColor }}>
          3. Massnahmenübersicht
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="p-2">Nr.</th>
                <th className="p-2">Massnahme</th>
                <th className="p-2">Verantwortlich</th>
                <th className="p-2">Risiko</th>
                <th className="p-2">Frist</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {c.actions.map((a, i) => (
                <tr key={i} className={a.overdue ? "bg-red-50" : ""}>
                  <td className="border-line border-t p-2">{a.findingNumber}</td>
                  <td className="border-line border-t p-2">{a.description}</td>
                  <td className="border-line border-t p-2">{a.responsible ?? "–"}</td>
                  <td className="border-line border-t p-2">{a.riskLabel ?? "–"}</td>
                  <td className="border-line border-t p-2">{a.dueDate ?? "–"}</td>
                  <td className="border-line border-t p-2">
                    <ActionStatusBadge value={a.status} overdue={a.overdue} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xl font-bold" style={{ color: c.company.primaryColor }}>
          4. Positive Feststellungen
        </h3>
        {positives.length === 0 ? (
          <p className="text-ink-muted">Keine positiven Feststellungen erfasst.</p>
        ) : (
          positives.map((f) => <PreviewFinding key={f.id} f={f} imageUrls={imageUrls} />)
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-xl font-bold" style={{ color: c.company.primaryColor }}>
          5. Schlussbemerkung
        </h3>
        <p className="whitespace-pre-line">{c.closingText}</p>
        <p className="border-line text-ink-muted rounded border bg-slate-50 p-3 text-xs">Hinweis: {c.company.disclaimer}</p>
      </section>
    </article>
  );
}

function PreviewFinding({ f, imageUrls }: { f: ReportFinding; imageUrls: Record<string, string> }) {
  return (
    <div className="border-line space-y-2 rounded border p-3">
      <p className="font-semibold">
        {f.number}. {f.title}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <AssessmentBadge value={f.assessment} />
        <RiskBadge value={f.riskLevel} />
        <ActionStatusBadge value={f.status} overdue={f.overdue} />
        {f.recurring && <Tag className="border-violet-300 bg-violet-50 text-violet-800">Wiederkehrend · Score {f.recurring.score}</Tag>}
      </div>
      {f.category && (
        <p className="text-ink-muted text-sm">
          {f.category}
          {f.location ? ` · ${f.location}` : ""}
        </p>
      )}
      {f.description && <p>{f.description}</p>}
      {f.action && (
        <p className="text-sm">
          <span className="font-semibold">Massnahme:</span> {f.action}{" "}
          <span className="text-ink-muted">
            (Verantwortlich: {f.responsible ?? "–"}, Frist: {f.dueDate ?? "–"})
          </span>
        </p>
      )}
      {f.references.length > 0 && (
        <ul className="text-ink-muted list-inside list-disc text-xs">
          {f.references.map((r) => (
            <li key={r.label}>
              {r.label}
              {r.reviewNote ? ` (${r.reviewNote})` : ""}
            </li>
          ))}
        </ul>
      )}
      {f.recurring && <p className="text-sm text-violet-800">{f.recurring.text}</p>}
      {f.images.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {f.images.map(
            (img) =>
              imageUrls[img.path] && (
                <figure key={img.path}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrls[img.path]} alt={img.caption ?? f.title} className="aspect-[4/3] w-full rounded object-cover" />
                  {img.caption && <figcaption className="text-ink-muted mt-1 text-xs">{img.caption}</figcaption>}
                </figure>
              ),
          )}
        </div>
      )}
    </div>
  );
}
