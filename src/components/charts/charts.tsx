"use client";

import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/**
 * Diagrammstil (siehe docs/architecture.md → Diagramme):
 *  - Beurteilungen verwenden die Statusfarben (mit Legende, 2px-Abständen, Tooltip und Tabellenansicht)
 *  - Magnitude: eine Farbe (Blau), eine Achse, zurückhaltende Gitterlinien
 *  - Jede Grafik verlinkt auf die zugrunde liegenden Feststellungen
 */
export const CHART = {
  negative: "#b91c1c",
  improvement: "#d97706",
  positive: "#15803d",
  series1: "#2a78d6",
  series2: "#eb6834",
  grid: "#e5e7eb",
  axis: "#4b5563",
} as const;

const axisProps = { tick: { fill: CHART.axis, fontSize: 12 }, axisLine: { stroke: CHART.grid }, tickLine: false } as const;

function TableFallback({ caption, head, rows }: { caption: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="mt-2 text-sm">
      <summary className="min-h-10 cursor-pointer font-semibold text-info">Als Tabelle anzeigen</summary>
      <div className="mt-2 overflow-x-auto">
      <table className="w-full text-left">
        <caption className="sr-only">{caption}</caption>
        <thead><tr>{head.map((h) => <th key={h} className="border-b border-line p-1.5">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="border-b border-line p-1.5">{c}</td>)}</tr>)}</tbody>
      </table>
      </div>
    </details>
  );
}

export function WeeklyAssessmentChart({ data, drillBase }: { data: { week: string; label: string; negative: number; improvement: number; positive: number }[]; drillBase: string }) {
  const router = useRouter();
  return (
    <div>
      <div className="h-64" role="img" aria-label="Feststellungen pro Woche nach Beurteilung">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap="20%"
            onClick={(s) => { const w = (s as { activeLabel?: string })?.activeLabel; const p = data.find((d) => d.label === w); if (p) router.push(`${drillBase}&von=${p.week}`); }}>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip cursor={{ fill: "rgba(15,23,42,0.06)" }} />
            <Legend wrapperStyle={{ fontSize: 13 }} />
            <Bar dataKey="negative" name="Abweichungen" stackId="a" fill={CHART.negative} stroke="#fff" strokeWidth={2} cursor="pointer" />
            <Bar dataKey="improvement" name="Verbesserungen" stackId="a" fill={CHART.improvement} stroke="#fff" strokeWidth={2} cursor="pointer" />
            <Bar dataKey="positive" name="Positiv" stackId="a" fill={CHART.positive} stroke="#fff" strokeWidth={2} radius={[4, 4, 0, 0]} cursor="pointer" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <TableFallback caption="Feststellungen pro Woche" head={["Woche ab", "Abweichungen", "Verbesserungen", "Positiv"]} rows={data.map((d) => [d.label, d.negative, d.improvement, d.positive])} />
    </div>
  );
}

export function HorizontalBarChart({ data, label, hrefs }: { data: { id: string; name: string; n: number }[]; label: string; hrefs: Record<string, string> }) {
  const router = useRouter();
  const height = Math.max(160, data.length * 34 + 20);
  return (
    <div>
      <div style={{ height }} role="img" aria-label={label}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
            <CartesianGrid stroke={CHART.grid} horizontal={false} />
            <XAxis type="number" allowDecimals={false} {...axisProps} />
            <YAxis type="category" dataKey="name" width={170} {...axisProps} tick={{ fill: "#111827", fontSize: 12 }} />
            <Tooltip cursor={{ fill: "rgba(15,23,42,0.06)" }} formatter={(v) => [v, "Anzahl"]} />
            <Bar dataKey="n" name="Anzahl" fill={CHART.series1} radius={[0, 4, 4, 0]} barSize={18} cursor="pointer"
              label={{ position: "right", fill: "#111827", fontSize: 12 }}
              onClick={(d) => { const h = hrefs[(d as unknown as { id: string }).id]; if (h) router.push(h); }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <TableFallback caption={label} head={["Kategorie", "Anzahl"]} rows={data.map((d) => [d.name, d.n])} />
    </div>
  );
}

export function CompanyAssessmentChart({ data, hrefs }: { data: { id: string; name: string; shortCode: string; negative: number; improvement: number; positive: number }[]; hrefs: Record<string, string> }) {
  const router = useRouter();
  return (
    <div>
      <div className="h-64" role="img" aria-label="Beurteilungen nach Gesellschaft">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap="30%"
            onClick={(s) => { const i = (s as { activeTooltipIndex?: number })?.activeTooltipIndex; if (typeof i === "number" && data[i] && hrefs[data[i].id]) router.push(hrefs[data[i].id]); }}>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="shortCode" {...axisProps} />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip labelFormatter={(l) => data.find((d) => d.shortCode === l)?.name ?? l} cursor={{ fill: "rgba(15,23,42,0.06)" }} />
            <Legend wrapperStyle={{ fontSize: 13 }} />
            <Bar dataKey="negative" name="Abweichungen" stackId="a" fill={CHART.negative} stroke="#fff" strokeWidth={2} cursor="pointer" />
            <Bar dataKey="improvement" name="Verbesserungen" stackId="a" fill={CHART.improvement} stroke="#fff" strokeWidth={2} cursor="pointer" />
            <Bar dataKey="positive" name="Positiv" stackId="a" fill={CHART.positive} stroke="#fff" strokeWidth={2} radius={[4, 4, 0, 0]} cursor="pointer" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <TableFallback caption="Beurteilungen nach Gesellschaft" head={["Gesellschaft", "Abweichungen", "Verbesserungen", "Positiv"]} rows={data.map((d) => [d.name, d.negative, d.improvement, d.positive])} />
    </div>
  );
}

export function TwoLineChart({ data, aLabel, bLabel }: { data: { label: string; a: number; b: number }[]; aLabel: string; bLabel: string }) {
  return (
    <div>
      <div className="h-64" role="img" aria-label={`${aLabel} und ${bLabel} pro Monat`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 13 }} />
            <Line type="monotone" dataKey="a" name={aLabel} stroke={CHART.series1} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="b" name={bLabel} stroke={CHART.series2} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} strokeDasharray="6 3" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <TableFallback caption={`${aLabel} und ${bLabel}`} head={["Monat", aLabel, bLabel]} rows={data.map((d) => [d.label, d.a, d.b])} />
    </div>
  );
}
