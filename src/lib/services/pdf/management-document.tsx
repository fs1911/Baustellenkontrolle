import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ManagementData } from "@/lib/repositories/management";
import { formatDate, formatNumber, formatPercent } from "@/lib/utils/format";

const s = StyleSheet.create({
  page: { padding: 40, paddingBottom: 60, fontFamily: "Helvetica", fontSize: 9, color: "#111827" },
  h1: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 4, lineHeight: 1.2 },
  h2: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 14, marginBottom: 6, color: "#9a3412", lineHeight: 1.2 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#d1d5db" },
  th: { fontFamily: "Helvetica-Bold", padding: 3, backgroundColor: "#f3f4f6" },
  td: { padding: 3 },
  kpi: { flex: 1, borderWidth: 1, borderColor: "#d1d5db", padding: 6, marginRight: 4 },
  footer: { position: "absolute", top: 805, left: 40, right: 40, fontSize: 7, color: "#6b7280" },
});

function Tbl({ head, rows, widths }: { head: string[]; rows: (string | number)[][]; widths: number[] }) {
  return (
    <View>
      <View style={s.row}>
        {head.map((h, i) => (
          <Text key={h} style={[s.th, { flex: widths[i] }]}>
            {h}
          </Text>
        ))}
      </View>
      {rows.map((r, ri) => (
        <View key={ri} style={s.row} wrap={false}>
          {r.map((c, i) => (
            <Text key={i} style={[s.td, { flex: widths[i] }]}>
              {String(c)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

export function ManagementDocument({ d }: { d: ManagementData }) {
  const k = d.kpis;
  return (
    <Document title="Management-Übersicht Baustellenkontrollen" language="de-CH">
      <Page size="A4" style={s.page}>
        <Text
          style={s.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            `Seite ${pageNumber} von ${totalPages} · Management-Übersicht · keine personenbezogenen Auswertungen · erstellt ${formatDate(new Date())}`
          }
        />
        <Text style={s.h1}>Management-Übersicht Baustellenkontrollen</Text>
        <Text>
          Zeitraum {formatDate(d.filters.from)} – {formatDate(d.filters.to)}
        </Text>
        <Text style={s.h2}>Gruppenweite Lage</Text>
        <View style={{ flexDirection: "row" }}>
          {[
            ["Kontrollen", k.inspections],
            ["Feststellungen", k.findings],
            ["Abweichungen", k.negative],
            ["Kritisch", k.criticalDeviations],
            ["Überfällig", k.overdueActions],
            ["Erledigungsquote", formatPercent(k.completionRate)],
          ].map(([l, v]) => (
            <View key={l as string} style={s.kpi}>
              <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", lineHeight: 1.2 }}>{v}</Text>
              <Text>{l}</Text>
            </View>
          ))}
        </View>
        <Text style={{ marginTop: 4 }}>
          Abweichungen gegenüber Vorperiode: {k.deviationsCurrent} (Vorperiode {k.deviationsPrev})
        </Text>
        <Text style={s.h2}>Gesellschaftsvergleich</Text>
        <Tbl
          head={["Gesellschaft", "Kontr.", "Festst.", "Abw.", "Krit. offen", "Überf.", "Erled.", "Ø Tage"]}
          widths={[3, 1, 1, 1, 1, 1, 1, 1]}
          rows={d.companies.map((c) => [
            c.name,
            c.inspections,
            c.findings,
            c.deviations,
            c.criticalOpen,
            c.overdue,
            formatPercent(c.completionRate),
            c.avgDays === null ? "–" : formatNumber(c.avgDays, 1),
          ])}
        />
        <Text style={s.h2}>Entwicklung offener / überfälliger Massnahmen (Monatsende)</Text>
        <Tbl head={["Monat", "Offen", "Überfällig"]} widths={[2, 1, 1]} rows={d.months.map((m) => [m.label, m.open, m.overdue])} />
        <Text style={s.h2}>Wiederkehrende systemische Themen</Text>
        {d.themes.length === 0 ? (
          <Text>Keine.</Text>
        ) : (
          d.themes.map((t) => (
            <Text key={t.title} style={{ marginBottom: 4 }}>
              • {t.insight} (Score {t.score}) {t.recommendation ?? ""}
            </Text>
          ))
        )}
        <Text style={s.h2}>Kritische Einzelfälle</Text>
        {d.critical.length === 0 ? (
          <Text>Keine offenen kritischen Abweichungen.</Text>
        ) : (
          <Tbl
            head={["Feststellung", "Baustelle", "Erfasst", "Frist", "Überfällig"]}
            widths={[3, 2, 1, 1, 1]}
            rows={d.critical.map((c) => [c.title, c.siteName, formatDate(c.createdAt), formatDate(c.dueDate), c.overdue ? "ja" : "nein"])}
          />
        )}
      </Page>
    </Document>
  );
}
