import "server-only";
import type { Tx } from "@/lib/db/client";
import { getInspection, formatSiteAddress } from "@/lib/repositories/inspections";
import { listFindingsForInspection } from "@/lib/repositories/findings";
import { loadSettings } from "@/lib/repositories/settings";
import {
  ACTION_STATUS_LABEL, ASSESSMENT_LABEL, INSPECTION_TYPE_LABEL, REFERENCE_TYPE_LABEL, REVIEW_STATUS_LABEL, RISK_LABEL, RISK_WEIGHT,
  type ActionStatus, type Assessment, type ReportStatus, type RiskLevel,
} from "@/lib/domain/enums";
import type { SummaryInput } from "@/lib/domain/summary";
import { formatDate, formatDateTime, todayIso } from "@/lib/utils/format";

/**
 * Unveränderlicher Berichts-Snapshot (wird je Version als JSON gespeichert). Alle Texte sind bereits
 * formatiert, damit PDF und HTML-Vorschau identisch aus denselben Daten entstehen.
 * Hinweis: Schlüssel in camelCase (DB-Transformation), keine Personenbewertungen.
 */
export interface ReportContent {
  reportNumber: string;
  versionNo: number;
  status: ReportStatus;
  generatedAt: string;
  company: {
    id: string;
    name: string;
    address: string;
    primaryColor: string;
    logoPath: string | null;
    disclaimer: string;
    confidentialityNote: string | null;
  };
  inspection: {
    id: string;
    siteName: string;
    siteNumber: string;
    projectName: string | null;
    siteAddress: string;
    type: string;
    date: string;
    dateTime: string;
    inspector: string;
    participants: string[];
    weather: string | null;
    area: string | null;
  };
  counts: {
    total: number;
    positive: number;
    negative: number;
    improvement: number;
    criticalOrHigh: number;
    openActions: number;
    overdueActions: number;
    recurring: number;
  };
  summaryText: string;
  closingText: string;
  findings: ReportFinding[];
  actions: ReportAction[];
}

export interface ReportFinding {
  id: string;
  number: number;
  assessment: Assessment;
  assessmentLabel: string;
  title: string;
  description: string | null;
  category: string | null;
  riskLevel: RiskLevel | null;
  riskLabel: string | null;
  location: string | null;
  trade: string | null;
  action: string | null;
  responsible: string | null;
  dueDate: string | null;
  status: ActionStatus | null;
  statusLabel: string | null;
  overdue: boolean;
  references: { label: string; reviewNote: string | null }[];
  recurring: { score: number; text: string } | null;
  images: { path: string; caption: string | null }[];
}

export interface ReportAction {
  findingNumber: number;
  title: string;
  description: string;
  responsible: string | null;
  dueDate: string | null;
  dueIso: string | null;
  riskLevel: RiskLevel | null;
  riskLabel: string | null;
  statusLabel: string;
  status: ActionStatus;
  overdue: boolean;
}

export async function buildReportContent(
  tx: Tx,
  inspectionId: string,
  opts: { reportNumber: string; versionNo: number; status: ReportStatus; summaryText?: string | null; closingText?: string | null },
): Promise<{ content: ReportContent; summaryInput: SummaryInput } | null> {
  const i = await getInspection(tx, inspectionId);
  if (!i) return null;
  const findings = await listFindingsForInspection(tx, inspectionId);
  const settings = await loadSettings(tx);
  const recurring = await tx<{ findingId: string; score: number; insight: string }[]>`
    select distinct on (m.finding_id) m.finding_id, c.score::float as score, c.insight
    from public.recurring_issue_cluster_members m join public.recurring_issue_clusters c on c.id = m.cluster_id
    where m.finding_id = any(${findings.map((f) => f.id)}::uuid[]) and c.scope = 'site'
    order by m.finding_id, c.score desc`;
  const recMap = new Map(recurring.map((r) => [r.findingId, r]));
  const today = todayIso();

  const reportFindings: ReportFinding[] = findings.map((f) => {
    const a = f.actions[0];
    const overdue = !!a && !!a.dueDate && (a.status === "open" || a.status === "in_progress") && a.dueDate < today;
    const rec = recMap.get(f.id);
    return {
      id: f.id,
      number: f.number,
      assessment: f.assessment,
      assessmentLabel: ASSESSMENT_LABEL[f.assessment],
      title: f.title,
      description: f.description,
      category: [f.categoryName, f.subcategoryName].filter(Boolean).join(" / ") || null,
      riskLevel: f.riskLevel,
      riskLabel: f.riskLevel ? RISK_LABEL[f.riskLevel] : null,
      location: f.location,
      trade: f.trade,
      action: a?.description ?? null,
      responsible: [a?.responsibleRole ?? f.responsibleRole, a?.responsiblePerson].filter(Boolean).join(" – ") || null,
      dueDate: a?.dueDate ? formatDate(a.dueDate) : null,
      status: f.status,
      statusLabel: f.status ? ACTION_STATUS_LABEL[f.status] : null,
      overdue,
      references: f.references.map((r) => ({
        label: r.code.startsWith(REFERENCE_TYPE_LABEL[r.referenceType].split(" ")[0]) ? `${r.code} – ${r.title}` : `${REFERENCE_TYPE_LABEL[r.referenceType]}: ${r.code} – ${r.title}`,
        reviewNote: r.reviewStatus === "approved" ? null : REVIEW_STATUS_LABEL[r.reviewStatus],
      })),
      recurring: rec ? { score: rec.score, text: rec.insight } : null,
      images: f.images.map((img) => ({ path: img.storagePath, caption: img.caption })),
    };
  });

  const actions: ReportAction[] = findings
    .flatMap((f) => f.actions.map((a) => ({ f, a })))
    .map(({ f, a }) => ({
      findingNumber: f.number,
      title: f.title,
      description: a.description,
      responsible: [a.responsibleRole ?? f.responsibleRole, a.responsiblePerson].filter(Boolean).join(" – ") || null,
      dueDate: a.dueDate ? formatDate(a.dueDate) : null,
      dueIso: a.dueDate,
      riskLevel: f.riskLevel,
      riskLabel: f.riskLevel ? RISK_LABEL[f.riskLevel] : null,
      statusLabel: ACTION_STATUS_LABEL[a.status],
      status: a.status,
      overdue: !!a.dueDate && (a.status === "open" || a.status === "in_progress") && a.dueDate < today,
    }))
    .sort((x, y) => {
      const open = (s: ActionStatus) => (s === "open" || s === "in_progress" ? 0 : 1);
      return (
        Number(y.overdue) - Number(x.overdue) ||
        open(x.status) - open(y.status) ||
        (y.riskLevel ? RISK_WEIGHT[y.riskLevel] : 0) - (x.riskLevel ? RISK_WEIGHT[x.riskLevel] : 0) ||
        (x.dueIso ?? "9999").localeCompare(y.dueIso ?? "9999")
      );
    });

  const deviations = findings.filter((f) => f.assessment !== "positive");
  const counts = {
    total: findings.length,
    positive: findings.filter((f) => f.assessment === "positive").length,
    negative: findings.filter((f) => f.assessment === "negative").length,
    improvement: findings.filter((f) => f.assessment === "improvement").length,
    criticalOrHigh: deviations.filter((f) => f.riskLevel === "critical" || f.riskLevel === "high").length,
    openActions: actions.filter((a) => a.status === "open" || a.status === "in_progress").length,
    overdueActions: actions.filter((a) => a.overdue).length,
    recurring: reportFindings.filter((f) => f.recurring).length,
  };

  const catCounts = new Map<string, number>();
  for (const f of deviations) if (f.categoryName) catCounts.set(f.categoryName, (catCounts.get(f.categoryName) ?? 0) + 1);
  const summaryInput: SummaryInput = {
    companyName: i.company.name,
    siteName: i.site.name,
    inspectionType: INSPECTION_TYPE_LABEL[i.inspectionType],
    inspectionDate: formatDate(i.inspectedAt),
    counts: {
      total: counts.total, positive: counts.positive, negative: counts.negative, improvement: counts.improvement,
      criticalOrHigh: counts.criticalOrHigh, openActions: counts.openActions, recurring: counts.recurring,
    },
    topCategories: Array.from(catCounts, ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    criticalItems: deviations
      .filter((f) => f.riskLevel === "critical" || f.riskLevel === "high")
      .sort((a, b) => RISK_WEIGHT[b.riskLevel!] - RISK_WEIGHT[a.riskLevel!])
      .map((f) => ({ title: f.title, category: f.categoryName, risk: RISK_LABEL[f.riskLevel!] })),
    positiveHighlights: findings.filter((f) => f.assessment === "positive").map((f) => f.title),
  };

  const content: ReportContent = {
    reportNumber: opts.reportNumber,
    versionNo: opts.versionNo,
    status: opts.status,
    generatedAt: formatDateTime(new Date()),
    company: {
      id: i.companyId,
      name: i.company.name,
      address: [i.company.street, [i.company.postalCode, i.company.city].filter(Boolean).join(" ")].filter(Boolean).join(", "),
      primaryColor: i.company.primaryColor && /^#[0-9a-f]{6}$/i.test(i.company.primaryColor) ? i.company.primaryColor : "#1f2937",
      logoPath: i.company.logoPath,
      disclaimer: i.company.reportDisclaimer?.trim() || settings.reports.defaultDisclaimer,
      confidentialityNote: i.company.confidentialityNote,
    },
    inspection: {
      id: i.id,
      siteName: i.site.name,
      siteNumber: i.site.siteNumber,
      projectName: i.site.projectName,
      siteAddress: formatSiteAddress(i.site),
      type: INSPECTION_TYPE_LABEL[i.inspectionType],
      date: formatDate(i.inspectedAt),
      dateTime: formatDateTime(i.inspectedAt),
      inspector: i.inspectorName,
      participants: i.participants.map((p) => [p.fullName, p.functionLabel, p.organisation].filter(Boolean).join(", ")),
      weather: i.weather,
      area: i.area,
    },
    counts,
    summaryText: opts.summaryText?.trim() || "",
    closingText: opts.closingText?.trim() || settings.reports.closingText,
    findings: reportFindings,
    actions,
  };
  return { content, summaryInput };
}
