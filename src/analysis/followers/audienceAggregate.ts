import type { FollowerSample } from "@/types/domain";
import type { AudienceAnalysis, AccountScore, Signal, Metric, DistributionBucket, SuspicionBand } from "@/types/results";
import { FEATURE_LABELS, FEATURE_DESCRIPTIONS, type FeatureKey, type SuspicionWeights } from "@/config/weights";
import { scoreAccounts } from "./suspicionScore";
import { wilsonInterval, scaleInterval, round, mean } from "@/analysis/statistics";

const BANDS: SuspicionBand[] = ["Likely Authentic", "Some Suspicious Signals", "Highly Suspicious", "Very High Suspicion"];

export const MIN_SAMPLE_FOR_ESTIMATE = 30;

function pctMetric(label: string, successes: number, n: number, population?: number): Metric {
  const iv = wilsonInterval(successes, n, 1.96, population);
  return {
    label,
    status: "estimated",
    value: round((successes / n) * 100, 1),
    interval: { low: round(iv.low * 100, 1), high: round(iv.high * 100, 1) },
    unit: "percent",
    note: `Wilson 95% interval from a sample of ${n}`,
  };
}

function countMetric(label: string, successes: number, n: number, population?: number): Metric {
  if (!population) {
    return { label, status: "unavailable", note: "Total follower count not observed; cannot scale sample to a count." };
  }
  const iv = scaleInterval(wilsonInterval(successes, n, 1.96, population), population);
  return {
    label,
    status: "estimated",
    value: Math.round((successes / n) * population),
    interval: iv,
    unit: "count",
    note: `Scaled from sample share to ${population.toLocaleString()} followers`,
  };
}

export function buildSignals(scores: AccountScore[]): Signal[] {
  const totals = new Map<FeatureKey, { contribution: number; fired: number }>();
  let grand = 0;
  for (const s of scores) {
    for (const c of s.contributions) {
      const key = c.key as FeatureKey;
      const cur = totals.get(key) ?? { contribution: 0, fired: 0 };
      cur.contribution += c.contribution;
      if (c.activation >= 0.3) cur.fired++;
      totals.set(key, cur);
      grand += c.contribution;
    }
  }
  const signals: Signal[] = [];
  for (const [key, t] of totals) {
    if (t.contribution <= 0) continue;
    signals.push({
      key,
      label: FEATURE_LABELS[key],
      share: grand > 0 ? t.contribution / grand : 0,
      prevalence: scores.length ? t.fired / scores.length : 0,
      description: FEATURE_DESCRIPTIONS[key],
    });
  }
  return signals.sort((a, b) => b.share - a.share);
}

export function histogram(scores: AccountScore[], bucketSize = 10): DistributionBucket[] {
  const buckets: DistributionBucket[] = [];
  for (let from = 0; from < 100; from += bucketSize) {
    const to = Math.min(100, from + bucketSize);
    buckets.push({ label: `${from}-${to}`, from, to, count: 0 });
  }
  for (const s of scores) {
    const idx = Math.min(buckets.length - 1, Math.floor(s.score / bucketSize));
    (buckets[idx] as DistributionBucket).count++;
  }
  return buckets;
}

function unavailableMetric(label: string, note: string): Metric {
  return { label, status: "unavailable", note };
}

export function insufficientAudience(missing: string[]): AudienceAnalysis {
  const note = "Requires a follower sample";
  return {
    status: "insufficient",
    missing,
    authenticityScore: unavailableMetric("Audience Authenticity Score", note),
    botFakeScore: unavailableMetric("Bot / Fake Follower Score", note),
    realPct: unavailableMetric("Estimated real followers %", note),
    suspiciousPct: unavailableMetric("Estimated suspicious followers %", note),
    botLikePct: unavailableMetric("Estimated fake / bot-like followers %", note),
    inactivePct: unavailableMetric("Estimated inactive followers %", note),
    massFollowingPct: unavailableMetric("Estimated mass-following accounts %", note),
    realCount: unavailableMetric("Estimated real followers", note),
    suspiciousCount: unavailableMetric("Estimated suspicious followers", note),
    bandDistribution: [],
    scoreHistogram: [],
    signals: [],
    accounts: [],
    explanation: {
      title: "Why no audience score?",
      summary: "No legitimately obtained follower sample is available for this account, so no audience estimate is produced.",
      drivers: missing.map((m) => ({ label: m, impact: 0, detail: "Missing input" })),
    },
  };
}

/**
 * Aggregate a scored follower sample into audience-level estimates.
 * Never extrapolates from fewer than MIN_SAMPLE_FOR_ESTIMATE accounts.
 */
export function analyzeAudience(
  sample: FollowerSample,
  weights: SuspicionWeights,
  now = Date.now(),
): AudienceAnalysis {
  const n = sample.accounts.length;
  if (n < MIN_SAMPLE_FOR_ESTIMATE) {
    return insufficientAudience([
      `Follower sample too small (${n} accounts, minimum ${MIN_SAMPLE_FOR_ESTIMATE})`,
    ]);
  }
  const population = sample.meta.populationSize;
  const scores = scoreAccounts(sample.accounts, weights, now);

  const bandCounts = new Map<SuspicionBand, number>(BANDS.map((b) => [b, 0]));
  for (const s of scores) bandCounts.set(s.band, (bandCounts.get(s.band) ?? 0) + 1);

  const real = bandCounts.get("Likely Authentic") ?? 0;
  const some = bandCounts.get("Some Suspicious Signals") ?? 0;
  const high = bandCounts.get("Highly Suspicious") ?? 0;
  const very = bandCounts.get("Very High Suspicion") ?? 0;
  const botLike = high + very;
  const suspicious = some + botLike; // everything that is not "Likely Authentic"

  const inactive = scores.filter((s) => s.contributions.some((c) => (c.key === "inactivity" || c.key === "emptyProfile") && c.activation >= 0.5)).length;
  const massFollow = scores.filter((s) => s.contributions.some((c) => c.key === "massFollowing" && c.activation >= 0.5)).length;

  // Bot/fake score: weighted share of suspicious mass in the sample (0..100)
  const meanScore = mean(scores.map((s) => s.score));
  const botFake = Math.round(0.5 * meanScore + 0.5 * ((some * 0.35 + high * 0.8 + very * 1.0) / n) * 100);
  const authenticity = 100 - botFake;

  const signals = buildSignals(scores);
  const hasInactivityData = sample.accounts.some((a) => a.lastPostAt !== undefined || a.postsCount !== undefined);
  const hasFollowData = sample.accounts.some((a) => a.followingCount !== undefined && a.followersCount !== undefined);

  const explanationDrivers = signals.slice(0, 6).map((s) => ({
    label: s.label,
    impact: round(s.share * 100, 0),
    detail: `${Math.round(s.prevalence * 100)}% of sampled accounts show this signal`,
  }));

  return {
    status: "ok",
    missing: [],
    authenticityScore: { label: "Audience Authenticity Score", status: "estimated", value: authenticity, unit: "score", note: "100 − Bot/Fake score" },
    botFakeScore: { label: "Bot / Fake Follower Score", status: "estimated", value: botFake, unit: "score", note: "0 = very authentic, 100 = extremely suspicious" },
    realPct: pctMetric("Estimated real followers %", real, n, population),
    suspiciousPct: pctMetric("Estimated suspicious followers %", suspicious, n, population),
    botLikePct: pctMetric("Estimated fake / bot-like followers %", botLike, n, population),
    inactivePct: hasInactivityData
      ? pctMetric("Estimated inactive followers %", inactive, n, population)
      : unavailableMetric("Estimated inactive followers %", "Sample lacks post counts / last-post dates"),
    massFollowingPct: hasFollowData
      ? pctMetric("Estimated mass-following accounts %", massFollow, n, population)
      : unavailableMetric("Estimated mass-following accounts %", "Sample lacks follower/following counts"),
    realCount: countMetric("Estimated real followers", real, n, population),
    suspiciousCount: countMetric("Estimated suspicious followers", suspicious, n, population),
    bandDistribution: BANDS.map((band) => ({ band, count: bandCounts.get(band) ?? 0, pct: round(((bandCounts.get(band) ?? 0) / n) * 100, 1) })),
    scoreHistogram: histogram(scores),
    signals,
    accounts: scores,
    explanation: {
      title: "Why this score?",
      summary: `Bot/Fake score ${botFake}/100 from ${n} sampled accounts: ${round((suspicious / n) * 100, 0)}% show suspicious signals, ${round((botLike / n) * 100, 0)}% strong ones. Mean per-account suspicion ${round(meanScore, 0)}.`,
      drivers: explanationDrivers,
    },
    sampleMeta: { method: sample.meta.method, representative: sample.meta.representative, sampleSize: n, populationSize: population },
  };
}
