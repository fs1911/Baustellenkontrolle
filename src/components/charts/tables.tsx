import Link from "next/link";
import type { ReactNode } from "react";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { RISK_LABEL, RISK_LEVELS, type RiskLevel } from "@/lib/domain/enums";

/** Sequenzielle Blau-Skala (hell → dunkel) für Heatmaps; Werte stehen immer als Zahl in der Zelle. */
const SEQ = ["#eff6ff", "#dbeafe", "#bfdbfe", "#93c5fd", "#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8", "#1e3a8a"];
function seq(n: number, max: number) {
  if (n <= 0 || max <= 0) return { bg: "#ffffff", fg: "#9ca3af" };
  const idx = Math.min(SEQ.length - 1, Math.max(1, Math.round((n / max) * (SEQ.length - 1))));
  return { bg: SEQ[idx], fg: idx >= 5 ? "#ffffff" : "#0f172a" };
}

export function KpiTile({ label, value, hint, tone = "neutral", href, trend }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "neutral" | "positive" | "negative" | "warning"; href?: string; trend?: { delta: number; goodWhenDown: boolean } }) {
  const toneCls = { neutral: "border-line", positive: "border-l-4 border-l-positive border-line", negative: "border-l-4 border-l-negative border-line", warning: "border-l-4 border-l-improve border-line" }[tone];
  const content = (
    <div className={cn("h-full rounded-[var(--radius-card)] border bg-white p-4 shadow-[var(--shadow-card)]", toneCls, href && "hover:border-line-strong")}>
      <p className="text-sm font-medium text-ink-muted">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
      {trend && (
        <p className={cn("mt-1 flex items-center gap-1 text-sm font-semibold",
          trend.delta === 0 ? "text-ink-muted" : (trend.delta < 0) === trend.goodWhenDown ? "text-positive" : "text-negative")}>
          {trend.delta > 0 ? <TrendingUp className="size-4" aria-hidden /> : trend.delta < 0 ? <TrendingDown className="size-4" aria-hidden /> : <Minus className="size-4" aria-hidden />}
          {trend.delta > 0 ? "+" : ""}{trend.delta} ggü. Vorperiode
        </p>
      )}
      {hint && <p className="mt-1 text-sm text-ink-muted">{hint}</p>}
    </div>
  );
  return href ? <Link href={href} className="block">{content}</Link> : content;
}

export function Heatmap({ cells, drill }: { cells: { categoryId: string; categoryName: string; siteId: string; siteName: string; n: number }[]; drill: (categoryId: string, siteId: string) => string }) {
  const cats = Array.from(new Map(cells.map((c) => [c.categoryId, c.categoryName]))).sort((a, b) => a[1].localeCompare(b[1]));
  const sites = Array.from(new Map(cells.map((c) => [c.siteId, c.siteName]))).sort((a, b) => a[1].localeCompare(b[1]));
  const max = Math.max(0, ...cells.map((c) => c.n));
  if (cells.length === 0) return <p className="text-ink-muted">Keine Abweichungen im gewählten Zeitraum.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0.5 text-sm">
        <caption className="sr-only">Abweichungen nach Kategorie und Baustelle</caption>
        <thead>
          <tr>
            <th scope="col" className="p-2 text-left text-xs text-ink-muted">Kategorie</th>
            {sites.map(([id, name]) => <th key={id} scope="col" className="min-w-24 p-2 text-left text-xs font-semibold">{name}</th>)}
          </tr>
        </thead>
        <tbody>
          {cats.map(([cid, cname]) => (
            <tr key={cid}>
              <th scope="row" className="p-2 text-left font-medium">{cname}</th>
              {sites.map(([sid, sname]) => {
                const n = cells.find((c) => c.categoryId === cid && c.siteId === sid)?.n ?? 0;
                const col = seq(n, max);
                return (
                  <td key={sid} className="p-0">
                    {n > 0 ? (
                      <Link href={drill(cid, sid)} className="flex min-h-11 items-center justify-center rounded font-bold tabular-nums hover:ring-2 hover:ring-ink" style={{ background: col.bg, color: col.fg }} title={`${cname} · ${sname}: ${n}`}>{n}</Link>
                    ) : (
                      <span className="flex min-h-11 items-center justify-center rounded bg-slate-50 text-ink-subtle" aria-label="0">·</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-ink-muted">Farbintensität = Anzahl Abweichungen und Verbesserungsmöglichkeiten; Zahl in jeder Zelle.</p>
    </div>
  );
}

export function RiskMatrix({ rows, drill }: { rows: { riskLevel: RiskLevel; bucket: "open" | "in_progress" | "done"; n: number }[]; drill: (risk: RiskLevel, status?: string) => string }) {
  const buckets = [["open", "Offen"], ["in_progress", "In Bearbeitung"], ["done", "Behoben / verifiziert / geschlossen"]] as const;
  const riskCls: Record<RiskLevel, string> = { critical: "bg-red-800 text-white", high: "bg-orange-800 text-white", medium: "bg-amber-300 text-black", low: "bg-slate-200 text-black" };
  const get = (r: RiskLevel, b: string) => rows.find((x) => x.riskLevel === r && x.bucket === b)?.n ?? 0;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0.5 text-sm">
        <caption className="sr-only">Risikomatrix: Risikostufe nach Bearbeitungsstand</caption>
        <thead><tr><th className="p-2 text-left text-xs text-ink-muted">Risikostufe</th>{buckets.map(([k, l]) => <th key={k} className="p-2 text-left text-xs">{l}</th>)}</tr></thead>
        <tbody>
          {[...RISK_LEVELS].reverse().map((r) => (
            <tr key={r}>
              <th scope="row" className={cn("rounded p-2 text-left font-bold", riskCls[r])}>{RISK_LABEL[r]}</th>
              {buckets.map(([b]) => {
                const n = get(r, b);
                const alarm = n > 0 && b !== "done" && (r === "critical" || r === "high");
                return (
                  <td key={b} className="p-0">
                    <Link href={drill(r, b === "done" ? undefined : b)} className={cn("flex min-h-11 items-center justify-center gap-1 rounded border font-bold tabular-nums", alarm ? "border-red-400 bg-red-50 text-red-900" : "border-line bg-white")}>
                      {n}{alarm && <span className="sr-only"> (Handlungsbedarf)</span>}{alarm && <span aria-hidden>!</span>}
                    </Link>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
