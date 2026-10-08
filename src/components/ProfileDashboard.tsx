"use client";
import { useState } from "react";
import Link from "next/link";
import type { ProfileAnalysisResult } from "@/types/results";
import { Card, MetricTile, ScoreRing, ConfidenceBadge, InsufficientData, WhyThisScore, SignalList, FacetTable, Tabs, DemoBanner, StatusPill, toneForAuthenticity, toneForSuspicion } from "./ui";
import { Donut, audienceDonutData, Histogram, BandBars, CoverageBars, SignalBars, EngagementCompare } from "./charts";
import { ReportButton } from "./ReportButton";
import { fmtInt } from "@/utils/format";

const TABS = ["Overview", "Audience", "Engagement", "Posts", "Comments", "Signals", "Methodology"] as const;
type Tab = (typeof TABS)[number];

export function ProfileDashboard({ r }: { r: ProfileAnalysisResult }) {
  const [tab, setTab] = useState<Tab>("Overview");
  const a = r.audience;
  const e = r.engagement;
  const organicLabel = r.score === undefined ? "Insufficient data" : r.score >= 80 ? "Appears largely organic" : r.score >= 65 ? "Mostly organic, with some suspicious signals" : r.score >= 45 ? "Significant suspicious signals" : "Strong signals of non-organic activity";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">@{r.profile.username} {r.profile.isVerified && <span className="text-accent">✔</span>}</h2>
          <p className="text-sm text-muted">{r.profile.fullName}{r.profile.isPrivate ? " · PRIVATE ACCOUNT" : ""} · analyzed {new Date(r.analyzedAt).toLocaleString()}</p>
          <div className="mt-2"><DemoBanner provider={r.provider} /></div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <ConfidenceBadge c={r.confidence} />
          <ReportButton result={r} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile m={r.profile.followers} />
        <MetricTile m={r.profile.following} />
        <MetricTile m={r.profile.posts} />
        <MetricTile m={r.profile.followRatio} />
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "Overview" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Organic score (estimated)" className="lg:col-span-1">
            <ScoreRing value={r.score} label="Overall authenticity" sub={organicLabel} />
            {r.score === undefined && a.status !== "ok" && <p className="mt-2 text-xs text-warn">INSUFFICIENT DATA — an overall score requires a follower sample. See the Audience tab for what is missing.</p>}
            <p className="mt-3 text-xs text-muted">Weighted combination of audience authenticity (60%) and engagement quality (40%) over the components with sufficient data.</p>
          </Card>
          <Card title="Bot / Fake follower score" className="lg:col-span-1">
            <ScoreRing value={a.botFakeScore.value} label="0 = very authentic · 100 = extremely suspicious" sub={a.status === "ok" ? `Audience authenticity ${a.authenticityScore.value}/100` : "Insufficient data"} invert />
          </Card>
          <Card title="Authentic vs suspicious audience" className="lg:col-span-1">
            {a.status === "ok" ? <Donut data={audienceDonutData(a.bandDistribution[0]?.pct ?? 0, a.bandDistribution[1]?.pct ?? 0, (a.bandDistribution[2]?.pct ?? 0) + (a.bandDistribution[3]?.pct ?? 0))} centerLabel={`${a.realPct.value}% real`} /> : <InsufficientData missing={a.missing} />}
          </Card>
          <Card title="Key estimates" className="lg:col-span-2">
            {a.status === "ok" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <MetricTile m={a.realPct} tone="ok" />
                <MetricTile m={a.suspiciousPct} tone={toneForSuspicion(a.suspiciousPct.value)} />
                <MetricTile m={a.realCount} />
                <MetricTile m={a.suspiciousCount} />
              </div>
            ) : <InsufficientData missing={a.missing} />}
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <MetricTile m={e.engagementRate} />
              <MetricTile m={e.expectedEngagementRate} />
            </div>
          </Card>
          <Card title="Confidence & data coverage">
            <CoverageBars facets={r.facets} />
            <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-muted">{r.confidence.reasons.map((x, i) => <li key={i}>{x}</li>)}</ul>
          </Card>
          <div className="lg:col-span-3 space-y-2">
            {a.status === "ok" && <WhyThisScore e={a.explanation} />}
            {e.status === "ok" && <WhyThisScore e={e.explanation} />}
          </div>
        </div>
      )}

      {tab === "Audience" && (
        a.status !== "ok" ? <Card title="Audience"><InsufficientData missing={a.missing} /></Card> : (
          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Audience Authenticity Score"><ScoreRing value={a.authenticityScore.value} label="Higher = more authentic" sub={`Sample: ${fmtInt(a.sampleMeta?.sampleSize)} accounts${a.sampleMeta?.populationSize ? ` of ${fmtInt(a.sampleMeta.populationSize)}` : ""} · ${a.sampleMeta?.method}${a.sampleMeta?.representative ? "" : " (not guaranteed representative)"}`} /></Card>
            <Card title="Follower quality distribution" className="lg:col-span-2"><BandBars bands={a.bandDistribution} /></Card>
            <Card title="Estimated breakdown" className="lg:col-span-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <MetricTile m={a.realPct} tone="ok" />
                <MetricTile m={a.suspiciousPct} tone={toneForSuspicion(a.suspiciousPct.value)} />
                <MetricTile m={a.botLikePct} tone={toneForSuspicion(a.botLikePct.value)} />
                <MetricTile m={a.inactivePct} />
                <MetricTile m={a.massFollowingPct} />
                <MetricTile m={a.botFakeScore} tone={toneForSuspicion(a.botFakeScore.value)} />
                <MetricTile m={a.realCount} />
                <MetricTile m={a.suspiciousCount} />
              </div>
            </Card>
            <Card title="Suspicion score distribution (per sampled account)" className="lg:col-span-2"><Histogram buckets={a.scoreHistogram} /></Card>
            <Card title="Suspicious audience signals"><SignalList signals={a.signals} /></Card>
            <Card title="Most suspicious sampled accounts" className="lg:col-span-3">
              <div className="max-h-80 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-panel text-left text-muted"><tr><th className="py-1 pr-2">Account</th><th className="py-1 pr-2">Score</th><th className="py-1 pr-2">Band</th><th className="py-1 pr-2">Signals</th><th className="py-1">Coverage</th></tr></thead>
                  <tbody>
                    {[...a.accounts].sort((x, y) => y.score - x.score).slice(0, 40).map((s) => (
                      <tr key={s.username} className="border-t border-line">
                        <td className="mono py-1 pr-2">{s.username}</td>
                        <td className="py-1 pr-2 tabular-nums">{s.score}</td>
                        <td className="py-1 pr-2">{s.band}</td>
                        <td className="py-1 pr-2 text-muted">{s.contributions.filter((c) => c.activation >= 0.3).map((c) => c.label).join(", ") || "—"}</td>
                        <td className="py-1 text-muted">{Math.round(s.featureCoverage * 100)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] text-muted">Per-account scores are suspicion ESTIMATES from multiple weighted signals; a high score is not proof that an account is automated.</p>
            </Card>
            <div className="lg:col-span-3"><WhyThisScore e={a.explanation} defaultOpen /></div>
          </div>
        )
      )}

      {tab === "Engagement" && (
        e.status !== "ok" ? <Card title="Engagement"><InsufficientData missing={e.missing} /></Card> : (
          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Engagement Quality Score"><ScoreRing value={e.qualityScore.value} label="100 = pattern consistent with organic audience" sub={`${e.postsAnalyzed} posts analyzed`} /></Card>
            <Card title="Engagement quality: observed vs expected" className="lg:col-span-2"><EngagementCompare observed={e.engagementRate.value} expected={e.expectedEngagementRate.value} low={e.expectedEngagementRate.interval?.low} high={e.expectedEngagementRate.interval?.high} /></Card>
            <Card title="Metrics" className="lg:col-span-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <MetricTile m={e.engagementRate} />
                <MetricTile m={e.expectedEngagementRate} />
                <MetricTile m={e.engagementRatio} />
                <MetricTile m={e.likesPerPostMedian} />
                <MetricTile m={e.commentsPerPostMedian} />
                <MetricTile m={e.commentsToLikesRatio} />
              </div>
            </Card>
            <Card title="Outlier posts (robust z ≥ 3.5)" className="lg:col-span-1">
              {e.outlierPosts.length ? <ul className="space-y-1 text-sm">{e.outlierPosts.map((o) => <li key={o.id} className="mono">{o.id}: {fmtInt(o.likes)} likes (z {o.robustZ})</li>)}</ul> : <p className="text-sm text-muted">No like-count outliers detected.</p>}
            </Card>
            <div className="lg:col-span-2"><WhyThisScore e={e.explanation} defaultOpen /></div>
          </div>
        )
      )}

      {tab === "Posts" && (
        <Card title={`Recent public posts (${r.posts.length})`}>
          {r.posts.length === 0 ? <InsufficientData missing={e.missing.length ? e.missing : ["Public posts"]} hint="No public posts could be obtained from the active provider." /> : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted"><tr><th className="py-1">Post</th><th className="py-1">Type</th><th className="py-1 text-right">Likes</th><th className="py-1 text-right">Comments</th><th className="py-1 text-right">Published</th><th className="py-1 text-right">Status</th></tr></thead>
              <tbody>
                {r.posts.map((p) => (
                  <tr key={p.id} className="border-t border-line">
                    <td className="mono py-1.5">{p.url ? <Link className="text-accent hover:underline" href={`/?q=${encodeURIComponent(p.url)}`}>{p.id}</Link> : p.id}</td>
                    <td className="py-1.5 capitalize">{p.kind}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmtInt(p.likes)}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmtInt(p.comments)}</td>
                    <td className="py-1.5 text-right text-muted">{p.publishedAt ? new Date(p.publishedAt).toLocaleDateString() : "—"}</td>
                    <td className="py-1.5 text-right"><StatusPill status="observed" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-xs text-muted">Click a post id to run a post-level analysis (likes, comments, authenticity).</p>
        </Card>
      )}

      {tab === "Comments" && (
        <Card title="Comments">
          <InsufficientData title="Comment analysis runs per post" missing={["Paste a post or reel URL (or click a post in the Posts tab) to analyze its comments: duplicates, generic phrases, spam, temporal bursts and repeat commenters."]} hint="Profile-level analysis does not aggregate comments across posts." />
        </Card>
      )}

      {tab === "Signals" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Suspicious audience signals (share of suspicious weight vs prevalence)">{a.status === "ok" ? <SignalBars signals={a.signals} /> : <InsufficientData missing={a.missing} />}</Card>
          <Card title="Signal details"><SignalList signals={a.signals} emptyText="No audience signals: follower sample unavailable." /></Card>
          <Card title="Engagement drivers" className="lg:col-span-2">{e.status === "ok" ? <WhyThisScore e={e.explanation} defaultOpen /> : <InsufficientData missing={e.missing} />}</Card>
        </div>
      )}

      {tab === "Methodology" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Observed · Estimated · Unavailable"><FacetTable facets={r.facets} /></Card>
          <Card title="How to read this">
            <ul className="list-disc space-y-1 pl-4 text-sm text-muted">
              <li><b className="text-text">Observed</b>: counts returned by the data source as-is.</li>
              <li><b className="text-text">Estimated</b>: model output from detected signals, with 95% intervals where meaningful.</li>
              <li><b className="text-text">Unavailable</b>: the source does not expose this data; nothing is invented.</li>
            </ul>
            <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-muted">{r.disclaimers.map((d, i) => <li key={i}>{d}</li>)}</ul>
            <Link href="/methodology" className="mt-3 inline-block text-sm text-accent hover:underline">Full methodology →</Link>
          </Card>
        </div>
      )}
    </div>
  );
}

export { toneForAuthenticity };
