import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { AnalysisResult, Metric, Signal, ScoreExplanation, DataFacet, ConfidenceReport, AudienceAnalysis, CommentAnalysis } from "@/types/results";

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 9.5, fontFamily: "Helvetica", color: "#111827" },
  h1: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  h2: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 14, marginBottom: 6, borderBottom: "1 solid #d1d5db", paddingBottom: 3 },
  sub: { color: "#6b7280", marginBottom: 8 },
  row: { flexDirection: "row", gap: 8 },
  tile: { flex: 1, border: "1 solid #e5e7eb", borderRadius: 4, padding: 6 },
  tileLabel: { color: "#6b7280", fontSize: 8 },
  tileValue: { fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 2 },
  pill: { fontSize: 7, color: "#374151", marginTop: 2 },
  small: { fontSize: 8, color: "#6b7280" },
  li: { marginBottom: 2 },
  warn: { backgroundColor: "#fffbeb", border: "1 solid #fcd34d", padding: 6, borderRadius: 4, marginBottom: 6 },
  table: { marginTop: 4 },
  tr: { flexDirection: "row", borderBottom: "1 solid #f3f4f6", paddingVertical: 2 },
  td: { flex: 1 },
  footer: { position: "absolute", bottom: 20, left: 36, right: 36, fontSize: 7, color: "#9ca3af", textAlign: "center" },
  demo: { backgroundColor: "#f5f3ff", border: "1 solid #c4b5fd", padding: 6, borderRadius: 4, marginBottom: 8, color: "#5b21b6" },
});

function fmt(m: Metric): string {
  if (m.status === "unavailable" || m.value === undefined) return "—";
  if (m.unit === "percent") return `${m.value.toFixed(1)}%`;
  if (m.unit === "ratio") return `×${m.value}`;
  if (m.unit === "score") return `${m.value} / 100`;
  return m.value.toLocaleString("en-US");
}
function iv(m: Metric): string {
  if (!m.interval) return "";
  return m.unit === "percent" ? ` (95%: ${m.interval.low.toFixed(0)}–${m.interval.high.toFixed(0)}%)` : ` (95%: ${m.interval.low.toLocaleString("en-US")}–${m.interval.high.toLocaleString("en-US")})`;
}

function Tile({ m }: { m: Metric }) {
  return (
    <View style={s.tile}>
      <Text style={s.tileLabel}>{m.label}</Text>
      <Text style={s.tileValue}>{fmt(m)}</Text>
      <Text style={s.pill}>{m.status.toUpperCase()}{iv(m)}</Text>
      {m.note && m.status === "unavailable" ? <Text style={s.small}>{m.note}</Text> : null}
    </View>
  );
}

function Tiles({ metrics }: { metrics: Metric[] }) {
  const rows: Metric[][] = [];
  for (let i = 0; i < metrics.length; i += 3) rows.push(metrics.slice(i, i + 3));
  return <View>{rows.map((r, i) => <View key={i} style={[s.row, { marginBottom: 6 }]}>{r.map((m) => <Tile key={m.label} m={m} />)}{r.length < 3 && Array.from({ length: 3 - r.length }).map((_, j) => <View key={`e${j}`} style={{ flex: 1 }} />)}</View>)}</View>;
}

function Signals({ signals }: { signals: Signal[] }) {
  if (!signals.length) return <Text style={s.small}>No signals computed.</Text>;
  return <View>{signals.map((sg) => <Text key={sg.key} style={s.li}>• {Math.round(sg.share * 100)}% — {sg.label} (present in {Math.round(sg.prevalence * 100)}% of sample)</Text>)}</View>;
}

function Why({ e }: { e: ScoreExplanation }) {
  return (
    <View style={{ marginTop: 4 }}>
      <Text style={{ fontFamily: "Helvetica-Bold" }}>{e.title}</Text>
      <Text style={s.small}>{e.summary}</Text>
      {e.drivers.map((d, i) => <Text key={i} style={s.li}>• {d.label}{d.impact ? ` (${d.impact}%)` : ""}: {d.detail}</Text>)}
    </View>
  );
}

function Insufficient({ missing }: { missing: string[] }) {
  return <View style={s.warn}><Text style={{ fontFamily: "Helvetica-Bold" }}>INSUFFICIENT DATA</Text>{missing.map((m, i) => <Text key={i} style={s.small}>• {m}</Text>)}</View>;
}

function Confidence({ c }: { c: ConfidenceReport }) {
  return (
    <View>
      <Text>Confidence: <Text style={{ fontFamily: "Helvetica-Bold" }}>{c.level}</Text> · Data coverage {Math.round(c.dataCoverage * 100)}% · Sample size {c.sampleSize.toLocaleString("en-US")}{c.populationSize ? ` of ${c.populationSize.toLocaleString("en-US")}` : ""}</Text>
      {c.reasons.map((r, i) => <Text key={i} style={s.small}>• {r}</Text>)}
    </View>
  );
}

function Facets({ facets }: { facets: DataFacet[] }) {
  return <View style={s.table}>{facets.map((f) => <View key={f.key} style={s.tr}><Text style={[s.td, { flex: 2 }]}>{f.label}</Text><Text style={s.td}>{f.status.toUpperCase()}</Text><Text style={[s.td, s.small, { flex: 2 }]}>{f.note ?? ""}</Text></View>)}</View>;
}

function AudienceSection({ a }: { a: AudienceAnalysis }) {
  if (a.status !== "ok") return <Insufficient missing={a.missing} />;
  return (
    <View>
      <Tiles metrics={[a.authenticityScore, a.botFakeScore, a.realPct, a.suspiciousPct, a.botLikePct, a.inactivePct, a.massFollowingPct, a.realCount, a.suspiciousCount]} />
      <Text style={{ fontFamily: "Helvetica-Bold", marginTop: 4 }}>Follower quality distribution</Text>
      {a.bandDistribution.map((b) => <Text key={b.band} style={s.li}>• {b.band}: {b.pct}% ({b.count})</Text>)}
      <Text style={{ fontFamily: "Helvetica-Bold", marginTop: 4 }}>Suspicious audience signals</Text>
      <Signals signals={a.signals} />
      <Why e={a.explanation} />
    </View>
  );
}

function CommentsSection({ c }: { c: CommentAnalysis }) {
  if (c.status !== "ok") return <Insufficient missing={c.missing} />;
  return (
    <View>
      <Tiles metrics={[c.total, c.authenticCount, c.suspiciousCount, c.suspiciousPct, c.authenticityScore]} />
      {c.duplicateGroups.length > 0 && <View><Text style={{ fontFamily: "Helvetica-Bold" }}>Duplicate text groups</Text>{c.duplicateGroups.slice(0, 8).map((g, i) => <Text key={i} style={s.li}>• “{g.text}” ×{g.count} from {g.authors} accounts</Text>)}</View>}
      {c.temporalBursts.length > 0 && <Text style={s.small}>{c.temporalBursts.length} temporal burst(s) detected.</Text>}
      <Text style={{ fontFamily: "Helvetica-Bold", marginTop: 4 }}>Comment signals</Text>
      <Signals signals={c.signals} />
      <Why e={c.explanation} />
    </View>
  );
}

export function ReportDocument({ r }: { r: AnalysisResult }) {
  const title = r.kind === "profile" ? `@${r.profile.username}` : r.kind === "post" ? `${r.post.kind} ${r.post.id}` : `Imported ${r.datasetType} dataset`;
  return (
    <Document title={`Authenticity report — ${title}`} author="Instagram Authenticity Analyzer">
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>Instagram Authenticity Report — {title}</Text>
        <Text style={s.sub}>Generated {new Date(r.analyzedAt).toLocaleString()} · All figures are ESTIMATES from detected signals, not verified facts.</Text>
        {"provider" in r && r.provider.isDemo && <View style={s.demo}><Text>DEMO DATA — this report was generated from a synthetic dataset ({r.provider.name}).</Text></View>}
        <Confidence c={r.confidence} />

        {r.kind === "profile" && (
          <View>
            <Text style={s.h2}>Profile</Text>
            <Tiles metrics={[r.profile.followers, r.profile.following, r.profile.posts, r.profile.followRatio, { label: "Organic / overall authenticity score", status: r.score === undefined ? "unavailable" : "estimated", value: r.score, unit: "score", note: "Insufficient components" }]} />
            <Text style={s.h2}>Audience</Text>
            <AudienceSection a={r.audience} />
            <Text style={s.h2}>Engagement</Text>
            {r.engagement.status !== "ok" ? <Insufficient missing={r.engagement.missing} /> : (
              <View>
                <Tiles metrics={[r.engagement.qualityScore, r.engagement.engagementRate, r.engagement.expectedEngagementRate, r.engagement.engagementRatio, r.engagement.likesPerPostMedian, r.engagement.commentsPerPostMedian, r.engagement.commentsToLikesRatio]} />
                <Why e={r.engagement.explanation} />
              </View>
            )}
            {r.posts.length > 0 && (
              <View>
                <Text style={s.h2}>Recent posts (observed)</Text>
                {r.posts.slice(0, 15).map((p) => <View key={p.id} style={s.tr}><Text style={s.td}>{p.id}</Text><Text style={s.td}>{p.kind}</Text><Text style={s.td}>{p.likes?.toLocaleString("en-US") ?? "—"} likes</Text><Text style={s.td}>{p.comments?.toLocaleString("en-US") ?? "—"} comments</Text><Text style={s.td}>{p.publishedAt ? new Date(p.publishedAt).toLocaleDateString() : ""}</Text></View>)}
              </View>
            )}
          </View>
        )}

        {r.kind === "post" && (
          <View>
            <Text style={s.h2}>Post</Text>
            <Tiles metrics={[r.post.likes, r.post.comments, r.post.views, r.overallScore, r.engagement.authenticityScore, r.engagement.rate, r.engagement.expectedRate, r.engagement.ratio, r.engagement.commentsToLikes]} />
            <Text style={s.h2}>Likes</Text>
            {r.likes.status !== "ok" ? <Insufficient missing={r.likes.missing} /> : <View><Tiles metrics={[r.likes.total, r.likes.authenticCount, r.likes.suspiciousCount, r.likes.suspiciousPct, r.likes.authenticPct]} /><Signals signals={r.likes.signals} /><Why e={r.likes.explanation} /></View>}
            <Text style={s.h2}>Comments</Text>
            <CommentsSection c={r.commentsAnalysis} />
          </View>
        )}

        {r.kind === "dataset" && (
          <View>
            <Text style={s.small}>{r.rowsAccepted.toLocaleString("en-US")} rows accepted of {r.rowsReceived.toLocaleString("en-US")} · {r.rowsRejected.length} rejected</Text>
            {r.audience && <View><Text style={s.h2}>Audience</Text><AudienceSection a={r.audience} /></View>}
            {r.commentsAnalysis && <View><Text style={s.h2}>Comments</Text><CommentsSection c={r.commentsAnalysis} /></View>}
          </View>
        )}

        <Text style={s.h2}>Data provenance — observed · estimated · unavailable</Text>
        <Facets facets={r.facets} />
        <Text style={s.h2}>Disclaimers</Text>
        {r.disclaimers.map((d, i) => <Text key={i} style={s.small}>• {d}</Text>)}
        <Text style={s.footer} render={({ pageNumber, totalPages }) => `Instagram Authenticity Analyzer · estimates, never verdicts · page ${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}
