"use client";
import { useState } from "react";
import Link from "next/link";
import type { PostAnalysisResult } from "@/types/results";
import { Card, MetricTile, ScoreRing, ConfidenceBadge, InsufficientData, WhyThisScore, SignalList, FacetTable, Tabs, DemoBanner, toneForSuspicion } from "./ui";
import { Donut, CoverageBars, SignalBars, Histogram, EngagementCompare } from "./charts";
import { histogram } from "@/analysis/followers/audienceAggregate";
import { ReportButton } from "./ReportButton";
import { fmtInt } from "@/utils/format";

const TABS = ["Overview", "Likes", "Engagement", "Comments", "Signals", "Methodology"] as const;
type Tab = (typeof TABS)[number];

export function PostDashboard({ r }: { r: PostAnalysisResult }) {
  const [tab, setTab] = useState<Tab>("Overview");
  const l = r.likes;
  const c = r.commentsAnalysis;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold capitalize">{r.post.kind} <span className="mono text-lg text-muted">{r.post.id}</span></h2>
          <p className="text-sm text-muted">{r.post.owner ? <Link href={`/?q=${encodeURIComponent("@" + r.post.owner)}`} className="text-accent hover:underline">@{r.post.owner}</Link> : "owner unknown"} · {r.post.publishedAt ? new Date(r.post.publishedAt).toLocaleDateString() : "date unknown"} · {r.post.url && <a href={r.post.url} target="_blank" rel="noreferrer" className="hover:underline">open on Instagram ↗</a>}</p>
          <div className="mt-2"><DemoBanner provider={r.provider} /></div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <ConfidenceBadge c={r.confidence} />
          <ReportButton result={r} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricTile m={r.post.likes} />
        <MetricTile m={r.post.comments} />
        <MetricTile m={r.post.views} />
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "Overview" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Overall post authenticity"><ScoreRing value={r.overallScore.value} label="Overall Authenticity Score" sub={r.overallScore.note ?? "Insufficient data"} /></Card>
          <Card title="Likes">
            {l.status === "ok" ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted">Total</span><b>{fmtInt(l.total.value)}</b></div>
                <div className="flex justify-between"><span className="text-muted">Estimated authentic</span><b className="text-ok">{fmtInt(l.authenticCount.value)}</b></div>
                <div className="flex justify-between"><span className="text-muted">Estimated suspicious</span><b className="text-bad">{fmtInt(l.suspiciousCount.value)}</b></div>
                <div className="flex justify-between"><span className="text-muted">Suspicious</span><b>{l.suspiciousPct.value}% <span className="mono text-xs text-muted">({l.suspiciousPct.interval?.low}–{l.suspiciousPct.interval?.high}%)</span></b></div>
              </div>
            ) : <InsufficientData missing={l.missing} />}
          </Card>
          <Card title="Comments">
            {c.status === "ok" ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted">Total</span><b>{fmtInt(c.total.value)}</b></div>
                <div className="flex justify-between"><span className="text-muted">Estimated authentic</span><b className="text-ok">{fmtInt(c.authenticCount.value)}</b></div>
                <div className="flex justify-between"><span className="text-muted">Estimated suspicious</span><b className="text-bad">{fmtInt(c.suspiciousCount.value)}</b></div>
                <div className="flex justify-between"><span className="text-muted">Comment Authenticity Score</span><b>{c.authenticityScore.value} / 100</b></div>
              </div>
            ) : <InsufficientData missing={c.missing} />}
          </Card>
          <Card title="Scores" className="lg:col-span-2">
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricTile m={c.authenticityScore} />
              <MetricTile m={r.engagement.authenticityScore} />
              <MetricTile m={r.overallScore} />
            </div>
          </Card>
          <Card title="Confidence & data coverage"><CoverageBars facets={r.facets} /><ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-muted">{r.confidence.reasons.map((x, i) => <li key={i}>{x}</li>)}</ul></Card>
          <div className="lg:col-span-3 space-y-2">
            <WhyThisScore e={{ title: "Why this overall score?", summary: r.overallScore.note ?? "Insufficient components.", drivers: [{ label: "Like authenticity", impact: l.status === "ok" ? 40 : 0, detail: l.status === "ok" ? `${100 - (l.suspiciousPct.value ?? 0)}/100` : "unavailable" }, { label: "Comment authenticity", impact: c.status === "ok" ? 35 : 0, detail: c.status === "ok" ? `${c.authenticityScore.value}/100` : "unavailable" }, { label: "Engagement pattern", impact: r.engagement.authenticityScore.value !== undefined ? 25 : 0, detail: r.engagement.authenticityScore.value !== undefined ? `${r.engagement.authenticityScore.value}/100` : "unavailable" }] }} />
          </div>
        </div>
      )}

      {tab === "Likes" && (
        l.status !== "ok" ? <Card title="Likes"><InsufficientData missing={l.missing} /></Card> : (
          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Authentic vs suspicious likes"><Donut data={[{ name: "Authentic", value: l.authenticPct.value ?? 0, color: "#22c55e" }, { name: "Suspicious", value: l.suspiciousPct.value ?? 0, color: "#ef4444" }]} centerLabel={`${l.authenticPct.value}% authentic`} /></Card>
            <Card title="Estimates" className="lg:col-span-2"><div className="grid gap-3 sm:grid-cols-2"><MetricTile m={l.total} /><MetricTile m={l.authenticCount} tone="ok" /><MetricTile m={l.suspiciousCount} tone={toneForSuspicion(l.suspiciousPct.value)} /><MetricTile m={l.suspiciousPct} tone={toneForSuspicion(l.suspiciousPct.value)} /></div></Card>
            <Card title="Liker suspicion distribution" className="lg:col-span-2"><Histogram buckets={histogram(l.sampleScores)} /></Card>
            <Card title="Liker signals"><SignalList signals={l.signals} /></Card>
            <div className="lg:col-span-3"><WhyThisScore e={l.explanation} defaultOpen /></div>
          </div>
        )
      )}

      {tab === "Engagement" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Engagement Authenticity Score"><ScoreRing value={r.engagement.authenticityScore.value} label="Pattern vs similar accounts" /></Card>
          <Card title="Observed vs expected" className="lg:col-span-2"><EngagementCompare observed={r.engagement.rate.value} expected={r.engagement.expectedRate.value} low={r.engagement.expectedRate.interval?.low} high={r.engagement.expectedRate.interval?.high} /></Card>
          <Card title="Metrics" className="lg:col-span-3"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><MetricTile m={r.engagement.rate} /><MetricTile m={r.engagement.expectedRate} /><MetricTile m={r.engagement.ratio} /><MetricTile m={r.engagement.commentsToLikes} /></div></Card>
          <div className="lg:col-span-3"><WhyThisScore e={r.engagement.explanation} defaultOpen /></div>
        </div>
      )}

      {tab === "Comments" && (
        c.status !== "ok" ? <Card title="Comments"><InsufficientData missing={c.missing} /></Card> : (
          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Comment quality"><Donut data={[{ name: "Authentic", value: 100 - (c.suspiciousPct.value ?? 0), color: "#22c55e" }, { name: "Suspicious", value: c.suspiciousPct.value ?? 0, color: "#ef4444" }]} centerLabel={`${c.authenticityScore.value}/100`} /></Card>
            <Card title="Estimates" className="lg:col-span-2"><div className="grid gap-3 sm:grid-cols-2"><MetricTile m={c.total} /><MetricTile m={c.authenticityScore} /><MetricTile m={c.authenticCount} tone="ok" /><MetricTile m={c.suspiciousCount} tone={toneForSuspicion(c.suspiciousPct.value)} /></div></Card>
            <Card title="Duplicate text groups">{c.duplicateGroups.length ? <ul className="space-y-1 text-sm">{c.duplicateGroups.map((g, i) => <li key={i} className="flex justify-between gap-2"><span className="truncate">“{g.text}”</span><span className="mono shrink-0 text-xs text-muted">×{g.count} · {g.authors} accounts</span></li>)}</ul> : <p className="text-sm text-muted">No identical texts from multiple accounts.</p>}</Card>
            <Card title="Temporal bursts">{c.temporalBursts.length ? <ul className="space-y-1 text-sm">{c.temporalBursts.map((b, i) => <li key={i} className="mono text-xs">{new Date(b.start).toLocaleString()} → {new Date(b.end).toLocaleTimeString()} · {b.count} comments</li>)}</ul> : <p className="text-sm text-muted">No anomalous bursts (or no timestamps available).</p>}</Card>
            <Card title="Comment signals"><SignalList signals={c.signals} /></Card>
            <Card title="Flagged comments (suspicion > 40)" className="lg:col-span-3">
              {c.flagged.length ? (
                <div className="max-h-80 overflow-auto">
                  <table className="w-full text-xs"><thead className="sticky top-0 bg-panel text-left text-muted"><tr><th className="py-1 pr-2">Score</th><th className="py-1 pr-2">Author</th><th className="py-1 pr-2">Text</th><th className="py-1">Reasons</th></tr></thead>
                    <tbody>{c.flagged.map((f) => <tr key={f.id} className="border-t border-line"><td className="py-1 pr-2 tabular-nums">{f.score}</td><td className="mono py-1 pr-2">{f.author}</td><td className="py-1 pr-2">{f.text}</td><td className="py-1 text-muted">{f.reasons.join(", ")}</td></tr>)}</tbody></table>
                </div>
              ) : <p className="text-sm text-muted">No comments exceeded the suspicion threshold.</p>}
            </Card>
            <div className="lg:col-span-3"><WhyThisScore e={c.explanation} defaultOpen /></div>
          </div>
        )
      )}

      {tab === "Signals" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Liker signals">{l.status === "ok" ? <SignalBars signals={l.signals} /> : <InsufficientData missing={l.missing} />}</Card>
          <Card title="Comment signals">{c.status === "ok" ? <SignalBars signals={c.signals} /> : <InsufficientData missing={c.missing} />}</Card>
        </div>
      )}

      {tab === "Methodology" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Observed · Estimated · Unavailable"><FacetTable facets={r.facets} /></Card>
          <Card title="Notes"><ul className="list-disc space-y-1 pl-4 text-xs text-muted">{r.disclaimers.map((d, i) => <li key={i}>{d}</li>)}</ul><Link href="/methodology" className="mt-3 inline-block text-sm text-accent hover:underline">Full methodology →</Link></Card>
        </div>
      )}
    </div>
  );
}
