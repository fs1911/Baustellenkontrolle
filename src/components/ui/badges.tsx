import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Clock,
  Lightbulb,
  Loader,
  ShieldCheck,
  ThumbsUp,
  TriangleAlert,
  XCircle,
  Archive,
  Send,
  FileText,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  ACTION_STATUS_LABEL,
  ASSESSMENT_LABEL,
  INSPECTION_STATUS_LABEL,
  REPORT_STATUS_LABEL,
  RISK_LABEL,
  REVIEW_STATUS_LABEL,
  type ActionStatus,
  type Assessment,
  type InspectionStatus,
  type ReportStatus,
  type ReviewStatus,
  type RiskLevel,
} from "@/lib/domain/enums";

const base = "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-sm font-semibold whitespace-nowrap";

export function AssessmentBadge({ value, className }: { value: Assessment; className?: string }) {
  const map = {
    positive: { cls: "bg-positive-soft text-positive border-green-300", Icon: ThumbsUp },
    negative: { cls: "bg-negative-soft text-negative border-red-300", Icon: XCircle },
    improvement: { cls: "bg-improve-soft text-improve border-amber-300", Icon: Lightbulb },
  }[value];
  return (
    <span className={cn(base, map.cls, className)}>
      <map.Icon className="size-4" aria-hidden />
      {ASSESSMENT_LABEL[value]}
    </span>
  );
}

export function RiskBadge({ value, className }: { value: RiskLevel | null; className?: string }) {
  if (!value) return null;
  const map = {
    low: { cls: "bg-slate-100 text-risk-low border-slate-300", Icon: CircleDot },
    medium: { cls: "bg-amber-50 text-risk-medium border-amber-300", Icon: AlertTriangle },
    high: { cls: "bg-orange-50 text-risk-high border-orange-300", Icon: TriangleAlert },
    critical: { cls: "bg-red-700 text-white border-red-900", Icon: AlertOctagon },
  }[value];
  return (
    <span className={cn(base, map.cls, className)} title={`Risikostufe: ${RISK_LABEL[value]}`}>
      <map.Icon className="size-4" aria-hidden />
      <span className="sr-only">Risiko </span>
      {RISK_LABEL[value]}
    </span>
  );
}

export function ActionStatusBadge({ value, overdue, className }: { value: ActionStatus | null; overdue?: boolean; className?: string }) {
  if (!value) return null;
  if (overdue) {
    return (
      <span className={cn(base, "bg-negative border-red-900 text-white", className)}>
        <Clock className="size-4" aria-hidden />
        Überfällig · {ACTION_STATUS_LABEL[value]}
      </span>
    );
  }
  const map = {
    open: { cls: "bg-white text-negative border-red-300", Icon: CircleDot },
    in_progress: { cls: "bg-improve-soft text-improve border-amber-300", Icon: Loader },
    resolved: { cls: "bg-info-soft text-info border-blue-300", Icon: CheckCircle2 },
    verified: { cls: "bg-positive-soft text-positive border-green-300", Icon: ShieldCheck },
    closed: { cls: "bg-positive text-white border-green-900", Icon: CheckCircle2 },
  }[value];
  return (
    <span className={cn(base, map.cls, className)}>
      <map.Icon className="size-4" aria-hidden />
      {ACTION_STATUS_LABEL[value]}
    </span>
  );
}

export function InspectionStatusBadge({ value }: { value: InspectionStatus }) {
  const map = {
    draft: { cls: "bg-slate-100 text-ink-muted border-slate-300", Icon: FileText },
    completed: { cls: "bg-positive-soft text-positive border-green-300", Icon: CheckCircle2 },
    archived: { cls: "bg-slate-200 text-ink-muted border-slate-300", Icon: Archive },
  }[value];
  return (
    <span className={cn(base, map.cls)}>
      <map.Icon className="size-4" aria-hidden />
      {INSPECTION_STATUS_LABEL[value]}
    </span>
  );
}

export function ReportStatusBadge({ value }: { value: ReportStatus }) {
  const map = {
    draft: { cls: "bg-slate-100 text-ink-muted border-slate-300", Icon: FileText },
    in_review: { cls: "bg-improve-soft text-improve border-amber-300", Icon: Eye },
    released: { cls: "bg-info-soft text-info border-blue-300", Icon: ShieldCheck },
    sent: { cls: "bg-positive-soft text-positive border-green-300", Icon: Send },
    send_failed: { cls: "bg-negative-soft text-negative border-red-300", Icon: XCircle },
  }[value];
  return (
    <span className={cn(base, map.cls)}>
      <map.Icon className="size-4" aria-hidden />
      {REPORT_STATUS_LABEL[value]}
    </span>
  );
}

export function ReviewStatusBadge({ value }: { value: ReviewStatus }) {
  const map = {
    to_review: { cls: "bg-improve-soft text-improve border-amber-300", Icon: AlertTriangle },
    approved: { cls: "bg-positive-soft text-positive border-green-300", Icon: ShieldCheck },
    retired: { cls: "bg-slate-200 text-ink-muted border-slate-300", Icon: Archive },
  }[value];
  return (
    <span className={cn(base, map.cls)}>
      <map.Icon className="size-4" aria-hidden />
      {REVIEW_STATUS_LABEL[value]}
    </span>
  );
}

export function AiBadge({ className }: { className?: string }) {
  return (
    <span className={cn(base, "border-violet-300 bg-violet-50 text-violet-800", className)}>
      <Lightbulb className="size-4" aria-hidden />
      Vorschlag
    </span>
  );
}

export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn(base, "border-line text-ink-muted bg-slate-50 font-medium", className)}>{children}</span>;
}
