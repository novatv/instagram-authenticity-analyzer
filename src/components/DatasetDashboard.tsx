"use client";
import type { DatasetAnalysisResult } from "@/types/results";
import { Card, MetricTile, ScoreRing, ConfidenceBadge, InsufficientData, WhyThisScore, SignalList, FacetTable, toneForSuspicion } from "./ui";
import { Donut, audienceDonutData, Histogram, BandBars, CoverageBars, SignalBars } from "./charts";
import { ReportButton } from "./ReportButton";
import { fmtInt } from "@/utils/format";

export function DatasetDashboard({ r }: { r: DatasetAnalysisResult }) {
  const a = r.audience;
  const c = r.commentsAnalysis;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Imported {r.datasetType} dataset</h2>
          <p className="text-sm text-muted">{fmtInt(r.rowsAccepted)} rows accepted of {fmtInt(r.rowsReceived)} received · {r.rowsRejected.length} rejected · processed in memory, not stored</p>
        </div>
        <div className="flex flex-col items-end gap-2"><ConfidenceBadge c={r.confidence} /><ReportButton result={r} /></div>
      </div>

      {r.rowsRejected.length > 0 && (
        <Card title={`Rejected rows (${r.rowsRejected.length}${r.rowsRejected.length >= 200 ? "+" : ""})`}>
          <ul className="max-h-32 overflow-auto text-xs text-muted">{r.rowsRejected.slice(0, 50).map((x, i) => <li key={i}>row {x.row}: {x.reason}</li>)}</ul>
        </Card>
      )}

      {a && (a.status !== "ok" ? <Card title="Audience"><InsufficientData missing={a.missing} /></Card> : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Audience Authenticity Score"><ScoreRing value={a.authenticityScore.value} label="Higher = more authentic" sub={`Bot/Fake score ${a.botFakeScore.value}/100`} /></Card>
          <Card title="Authentic vs suspicious"><Donut data={audienceDonutData(a.bandDistribution[0]?.pct ?? 0, a.bandDistribution[1]?.pct ?? 0, (a.bandDistribution[2]?.pct ?? 0) + (a.bandDistribution[3]?.pct ?? 0))} centerLabel={`${a.realPct.value}% real`} /></Card>
          <Card title="Follower quality distribution"><BandBars bands={a.bandDistribution} /></Card>
          <Card title="Estimates" className="lg:col-span-3"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><MetricTile m={a.realPct} tone="ok" /><MetricTile m={a.suspiciousPct} tone={toneForSuspicion(a.suspiciousPct.value)} /><MetricTile m={a.botLikePct} tone={toneForSuspicion(a.botLikePct.value)} /><MetricTile m={a.inactivePct} /><MetricTile m={a.massFollowingPct} /><MetricTile m={a.botFakeScore} /><MetricTile m={a.realCount} /><MetricTile m={a.suspiciousCount} /></div></Card>
          <Card title="Suspicion score distribution" className="lg:col-span-2"><Histogram buckets={a.scoreHistogram} /></Card>
          <Card title="Signals"><SignalList signals={a.signals} /></Card>
          <Card title="Signal shares" className="lg:col-span-2"><SignalBars signals={a.signals} /></Card>
          <Card title="Data coverage"><CoverageBars facets={r.facets} /></Card>
          <div className="lg:col-span-3"><WhyThisScore e={a.explanation} defaultOpen /></div>
        </div>
      ))}

      {c && (c.status !== "ok" ? <Card title="Comments"><InsufficientData missing={c.missing} /></Card> : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Comment Authenticity Score"><ScoreRing value={c.authenticityScore.value} label="Higher = more authentic" /></Card>
          <Card title="Estimates" className="lg:col-span-2"><div className="grid gap-3 sm:grid-cols-2"><MetricTile m={c.total} /><MetricTile m={c.suspiciousPct} tone={toneForSuspicion(c.suspiciousPct.value)} /><MetricTile m={c.authenticCount} tone="ok" /><MetricTile m={c.suspiciousCount} /></div></Card>
          <Card title="Duplicate groups">{c.duplicateGroups.length ? <ul className="space-y-1 text-sm">{c.duplicateGroups.map((g, i) => <li key={i} className="flex justify-between gap-2"><span className="truncate">“{g.text}”</span><span className="mono shrink-0 text-xs text-muted">×{g.count} · {g.authors} accounts</span></li>)}</ul> : <p className="text-sm text-muted">None.</p>}</Card>
          <Card title="Temporal bursts">{c.temporalBursts.length ? <ul className="space-y-1 text-xs mono">{c.temporalBursts.map((b, i) => <li key={i}>{new Date(b.start).toLocaleString()} · {b.count} comments</li>)}</ul> : <p className="text-sm text-muted">None (or no timestamps).</p>}</Card>
          <Card title="Signals"><SignalList signals={c.signals} /></Card>
          <Card title="Flagged comments" className="lg:col-span-2">{c.flagged.length ? <div className="max-h-72 overflow-auto"><table className="w-full text-xs"><tbody>{c.flagged.map((f) => <tr key={f.id} className="border-t border-line"><td className="py-1 pr-2 tabular-nums">{f.score}</td><td className="mono py-1 pr-2">{f.author}</td><td className="py-1 pr-2">{f.text}</td><td className="py-1 text-muted">{f.reasons.join(", ")}</td></tr>)}</tbody></table></div> : <p className="text-sm text-muted">None.</p>}</Card>
          <Card title="Data coverage"><CoverageBars facets={r.facets} /></Card>
          <div className="lg:col-span-3"><WhyThisScore e={c.explanation} defaultOpen /></div>
        </div>
      ))}

      <Card title="Observed · Estimated · Unavailable"><FacetTable facets={r.facets} /></Card>
    </div>
  );
}
