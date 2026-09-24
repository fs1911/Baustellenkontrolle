/* eslint-disable jsx-a11y/alt-text -- react-pdf <Image> unterstützt kein alt-Attribut; PDF-Bilder haben Legenden */
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ReportContent, ReportFinding } from "@/lib/services/reports/model";

/**
 * Druckreifes A4-Layout des Baustellenkontrollberichts (react-pdf, serverseitig).
 * Statusangaben immer als Text (nie nur Farbe). Schrift: Helvetica (PDF-Standardschrift).
 */
export interface ReportAssets {
  logo: Buffer | null;
  images: Record<string, Buffer>;
}

/** Logos sind PNG (sharp) oder – ohne native Bildverarbeitung – auch JPEG. */
const logoFormat = (data: Buffer): "png" | "jpg" => (data[0] === 0xff && data[1] === 0xd8 ? "jpg" : "png");

const ink = "#111827";
const muted = "#4b5563";
const line = "#d1d5db";

const ASSESSMENT_STYLE: Record<ReportFinding["assessment"], { bg: string; fg: string }> = {
  positive: { bg: "#dcfce7", fg: "#14532d" },
  negative: { bg: "#fee2e2", fg: "#7f1d1d" },
  improvement: { bg: "#fef3c7", fg: "#78350f" },
};
const RISK_STYLE: Record<string, { bg: string; fg: string }> = {
  low: { bg: "#f1f5f9", fg: "#334155" },
  medium: { bg: "#fef3c7", fg: "#78350f" },
  high: { bg: "#ffedd5", fg: "#7c2d12" },
  critical: { bg: "#991b1b", fg: "#ffffff" },
};

const s = StyleSheet.create({
  page: { paddingTop: 72, paddingBottom: 64, paddingHorizontal: 44, fontFamily: "Helvetica", fontSize: 9.5, color: ink, lineHeight: 1.4 },
  header: {
    position: "absolute",
    top: 22,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: line,
    paddingBottom: 8,
  },
  headerLogo: { height: 26, maxWidth: 110, objectFit: "contain" },
  headerText: { fontSize: 8, color: muted, textAlign: "right" },
  footerLine: { position: "absolute", top: 796, left: 44, right: 44, borderTopWidth: 1, borderTopColor: line },
  footerText: { position: "absolute", top: 802, left: 44, right: 44, fontSize: 7.5, color: muted },
  h1: { fontSize: 24, fontFamily: "Helvetica-Bold", marginBottom: 6, lineHeight: 1.2 },
  h2: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 8, marginTop: 4, lineHeight: 1.25 },
  h3: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  small: { fontSize: 8, color: muted },
  row: { flexDirection: "row" },
  metaRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: line, paddingVertical: 5 },
  metaLabel: { width: 150, color: muted },
  metaValue: { flex: 1, fontFamily: "Helvetica-Bold" },
  chip: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3, fontSize: 8, fontFamily: "Helvetica-Bold", marginRight: 4 },
  kpiBox: { flex: 1, borderWidth: 1, borderColor: line, borderRadius: 4, padding: 8, marginRight: 6 },
  kpiValue: { fontSize: 18, fontFamily: "Helvetica-Bold", lineHeight: 1.2, marginBottom: 2 },
  finding: { borderWidth: 1, borderColor: line, borderRadius: 4, padding: 10, marginBottom: 10 },
  fieldLabel: { color: muted, fontSize: 8 },
  imageGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
  imageBox: { width: "48%", marginRight: "2%", marginBottom: 6 },
  image: { width: "100%", height: 150, objectFit: "cover", borderRadius: 2 },
  th: { fontFamily: "Helvetica-Bold", fontSize: 8, color: "#ffffff", padding: 4 },
  td: { fontSize: 8, padding: 4 },
  notice: { borderWidth: 1, borderColor: line, backgroundColor: "#f9fafb", padding: 8, borderRadius: 4, fontSize: 8, color: muted },
});

function Header({ c, assets }: { c: ReportContent; assets: ReportAssets }) {
  return (
    <View style={s.header} fixed>
      {assets.logo ? (
        <Image style={s.headerLogo} src={{ data: assets.logo, format: logoFormat(assets.logo) }} />
      ) : (
        <Text style={s.h3}>{c.company.name}</Text>
      )}
      <View>
        <Text style={s.headerText}>Baustellenkontrollbericht {c.reportNumber}</Text>
        <Text style={s.headerText}>
          {c.inspection.siteName} · {c.inspection.date}
        </Text>
      </View>
    </View>
  );
}

function Footer({ c }: { c: ReportContent }) {
  const base = `${c.company.name} · Bericht-ID ${c.reportNumber} · Version ${c.versionNo} · erstellt ${c.generatedAt}${c.company.confidentialityNote ? " · Vertraulich" : ""}`;
  return (
    <>
      <View style={s.footerLine} fixed />
      <Text style={s.footerText} fixed render={({ pageNumber, totalPages }) => `Seite ${pageNumber} von ${totalPages} · ${base}`} />
    </>
  );
}

function Chip({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return <Text style={[s.chip, { backgroundColor: bg, color: fg }]}>{label}</Text>;
}

function Meta({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={s.metaRow}>
      <Text style={s.metaLabel}>{label}</Text>
      <Text style={s.metaValue}>{value || "–"}</Text>
    </View>
  );
}

function FindingBlock({ f, assets, color }: { f: ReportFinding; assets: ReportAssets; color: string }) {
  const a = ASSESSMENT_STYLE[f.assessment];
  return (
    <View style={[s.finding, { borderLeftWidth: 4, borderLeftColor: a.fg }]} wrap={f.images.length > 2}>
      <View style={[s.row, { justifyContent: "space-between", marginBottom: 4 }]} minPresenceAhead={60}>
        <Text style={[s.h3, { flex: 1, color }]}>
          {f.number}. {f.title}
        </Text>
      </View>
      <View style={[s.row, { marginBottom: 6, flexWrap: "wrap" }]}>
        <Chip label={f.assessmentLabel.toUpperCase()} bg={a.bg} fg={a.fg} />
        {f.riskLevel && (
          <Chip label={`RISIKO: ${f.riskLabel!.toUpperCase()}`} bg={RISK_STYLE[f.riskLevel].bg} fg={RISK_STYLE[f.riskLevel].fg} />
        )}
        {f.statusLabel && <Chip label={`STATUS: ${f.statusLabel.toUpperCase()}`} bg="#e5e7eb" fg={ink} />}
        {f.overdue && <Chip label="ÜBERFÄLLIG" bg="#b91c1c" fg="#ffffff" />}
        {f.recurring && <Chip label={`WIEDERKEHREND (SCORE ${f.recurring.score})`} bg="#ede9fe" fg="#4c1d95" />}
      </View>
      {f.category && (
        <Text style={s.small}>
          Kategorie: {f.category}
          {f.location ? ` · Ort: ${f.location}` : ""}
          {f.trade ? ` · Bereich: ${f.trade}` : ""}
        </Text>
      )}
      {f.description && <Text style={{ marginTop: 4 }}>{f.description}</Text>}
      {f.action && (
        <View style={{ marginTop: 6 }}>
          <Text style={s.fieldLabel}>Massnahme</Text>
          <Text>{f.action}</Text>
          <Text style={[s.small, { marginTop: 2 }]}>
            Verantwortlich: {f.responsible ?? "–"} · Frist: {f.dueDate ?? "–"}
          </Text>
        </View>
      )}
      {f.references.length > 0 && (
        <View style={{ marginTop: 6 }}>
          <Text style={s.fieldLabel}>Referenzen / Orientierungshilfen</Text>
          {f.references.map((r) => (
            <Text key={r.label} style={s.small}>
              • {r.label}
              {r.reviewNote ? ` (${r.reviewNote})` : ""}
            </Text>
          ))}
        </View>
      )}
      {f.recurring && <Text style={[s.small, { marginTop: 4, color: "#4c1d95" }]}>Hinweis: {f.recurring.text}</Text>}
      {f.images.length > 0 && (
        <View style={s.imageGrid}>
          {f.images.map((img) =>
            assets.images[img.path] ? (
              <View key={img.path} style={s.imageBox} wrap={false}>
                <Image style={s.image} src={{ data: assets.images[img.path], format: "jpg" }} />
                {img.caption && <Text style={[s.small, { marginTop: 2 }]}>{img.caption}</Text>}
              </View>
            ) : null,
          )}
        </View>
      )}
    </View>
  );
}

export function ReportDocument({ content: c, assets }: { content: ReportContent; assets: ReportAssets }) {
  const color = c.company.primaryColor;
  const deviations = c.findings.filter((f) => f.assessment !== "positive");
  const positives = c.findings.filter((f) => f.assessment === "positive");
  return (
    <Document
      title={`Baustellenkontrollbericht ${c.reportNumber}`}
      author={c.company.name}
      subject={c.inspection.siteName}
      language="de-CH"
      creator="Baustellenkontrolle"
    >
      {/* 1. Deckblatt */}
      <Page size="A4" style={s.page}>
        <Footer c={c} />
        <View style={{ marginTop: 10, marginBottom: 30 }}>
          {assets.logo && (
            <Image
              style={{ height: 70, maxWidth: 240, objectFit: "contain", marginBottom: 12 }}
              src={{ data: assets.logo, format: logoFormat(assets.logo) }}
            />
          )}
          <Text style={{ fontSize: 11, color: muted }}>
            {c.company.name}
            {c.company.address ? ` · ${c.company.address}` : ""}
          </Text>
        </View>
        <View style={{ borderLeftWidth: 6, borderLeftColor: color, paddingLeft: 12, marginBottom: 24 }}>
          <Text style={s.h1}>Baustellenkontrollbericht</Text>
          <Text style={{ fontSize: 14, lineHeight: 1.3 }}>{c.inspection.siteName}</Text>
        </View>
        <Meta label="Bericht-ID" value={c.reportNumber} />
        <Meta
          label="Baustelle / Projekt"
          value={`${c.inspection.siteName}${c.inspection.projectName && c.inspection.projectName !== c.inspection.siteName ? ` (${c.inspection.projectName})` : ""}`}
        />
        <Meta label="Baustellen-/Projektnummer" value={c.inspection.siteNumber} />
        <Meta label="Baustellenadresse" value={c.inspection.siteAddress} />
        <Meta label="Kontrolltyp" value={c.inspection.type} />
        <Meta label="Datum und Uhrzeit" value={c.inspection.dateTime} />
        <Meta label="Kontrollperson" value={c.inspection.inspector} />
        <Meta label="Anwesende Personen" value={c.inspection.participants.join("; ")} />
        {c.inspection.weather && <Meta label="Wetter" value={c.inspection.weather} />}
        {c.inspection.area && <Meta label="Kontrollbereich / Gewerk" value={c.inspection.area} />}
        <Meta
          label="Status des Berichts"
          value={
            c.status === "draft" || c.status === "in_review"
              ? "Entwurf – nicht freigegeben"
              : c.status === "sent"
                ? "Freigegeben und versendet"
                : "Freigegeben"
          }
        />
        <Meta label="Version" value={String(c.versionNo)} />
        {c.company.confidentialityNote && <Text style={[s.notice, { marginTop: 20 }]}>{c.company.confidentialityNote}</Text>}
      </Page>

      {/* 2.–6. Inhalt */}
      <Page size="A4" style={s.page}>
        <Header c={c} assets={assets} />
        <Footer c={c} />

        <Text style={[s.h2, { color }]}>1. Management Summary</Text>
        <View style={[s.row, { marginBottom: 10 }]}>
          {[
            ["Positiv", c.counts.positive],
            ["Abweichungen", c.counts.negative],
            ["Verbesserungen", c.counts.improvement],
            ["Hoch/kritisch", c.counts.criticalOrHigh],
            ["Offene Massnahmen", c.counts.openActions],
          ].map(([label, value]) => (
            <View key={label as string} style={s.kpiBox}>
              <Text style={s.kpiValue}>{value}</Text>
              <Text style={s.small}>{label}</Text>
            </View>
          ))}
        </View>
        {c.counts.recurring > 0 && (
          <Text style={[s.small, { marginBottom: 6 }]}>Wiederkehrende Abweichungshinweise: {c.counts.recurring}</Text>
        )}
        {c.counts.overdueActions > 0 && (
          <Text style={[s.small, { marginBottom: 6, color: "#991b1b" }]}>Überfällige Massnahmen: {c.counts.overdueActions}</Text>
        )}
        <Text style={{ marginBottom: 14 }}>{c.summaryText || "Keine Zusammenfassung erfasst."}</Text>

        <Text style={[s.h2, { color }]} break={false}>
          2. Feststellungen
        </Text>
        {deviations.length === 0 && <Text style={s.small}>Keine Abweichungen oder Verbesserungsmöglichkeiten.</Text>}
        {deviations.map((f) => (
          <FindingBlock key={f.id} f={f} assets={assets} color={ink} />
        ))}

        <Text style={[s.h2, { color }]} break>
          3. Massnahmenübersicht
        </Text>
        {c.actions.length === 0 ? (
          <Text style={s.small}>Keine Massnahmen.</Text>
        ) : (
          <View>
            <View style={[s.row, { backgroundColor: color }]} fixed>
              <Text style={[s.th, { width: 24 }]}>Nr.</Text>
              <Text style={[s.th, { flex: 3 }]}>Massnahme</Text>
              <Text style={[s.th, { flex: 1.4 }]}>Verantwortlich</Text>
              <Text style={[s.th, { width: 52 }]}>Risiko</Text>
              <Text style={[s.th, { width: 56 }]}>Frist</Text>
              <Text style={[s.th, { width: 70 }]}>Status</Text>
            </View>
            {c.actions.map((a, idx) => (
              <View
                key={`${a.findingNumber}-${idx}`}
                style={[
                  s.row,
                  {
                    borderBottomWidth: 0.5,
                    borderBottomColor: line,
                    backgroundColor: a.overdue ? "#fef2f2" : idx % 2 ? "#f9fafb" : "#ffffff",
                  },
                ]}
                wrap={false}
              >
                <Text style={[s.td, { width: 24 }]}>{a.findingNumber}</Text>
                <Text style={[s.td, { flex: 3 }]}>{a.description}</Text>
                <Text style={[s.td, { flex: 1.4 }]}>{a.responsible ?? "–"}</Text>
                <Text style={[s.td, { width: 52 }]}>{a.riskLabel ?? "–"}</Text>
                <Text style={[s.td, { width: 56 }]}>{a.dueDate ?? "–"}</Text>
                <Text
                  style={[s.td, { width: 70, fontFamily: a.overdue ? "Helvetica-Bold" : "Helvetica", color: a.overdue ? "#991b1b" : ink }]}
                >
                  {a.overdue ? `Überfällig (${a.statusLabel})` : a.statusLabel}
                </Text>
              </View>
            ))}
            <Text style={[s.small, { marginTop: 4 }]}>Sortierung: überfällig, offen, nach Risikostufe und Frist.</Text>
          </View>
        )}

        <Text style={[s.h2, { color, marginTop: 16 }]}>4. Positive Feststellungen</Text>
        {positives.length === 0 && <Text style={s.small}>Keine positiven Feststellungen erfasst.</Text>}
        {positives.map((f) => (
          <FindingBlock key={f.id} f={f} assets={assets} color={ink} />
        ))}

        <View wrap={false}>
          <Text style={[s.h2, { color, marginTop: 16 }]}>5. Schlussbemerkung</Text>
          <Text style={{ marginBottom: 10 }}>{c.closingText}</Text>
          <Text style={s.notice}>Hinweis: {c.company.disclaimer}</Text>
        </View>
      </Page>
    </Document>
  );
}
