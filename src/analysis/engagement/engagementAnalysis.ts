import type { PostData } from "@/types/domain";
import type { EngagementAnalysis, Metric } from "@/types/results";
import { median, round, detectOutliersRobust, clamp01, softThreshold } from "@/analysis/statistics";
import { tierFor } from "./benchmarks";

function unavailable(label: string, note: string): Metric {
  return { label, status: "unavailable", note };
}

export function insufficientEngagement(missing: string[]): EngagementAnalysis {
  const note = "Requires public posts with like/comment counts and a follower count";
  return {
    status: "insufficient",
    missing,
    engagementRate: unavailable("Engagement rate", note),
    expectedEngagementRate: unavailable("Expected engagement (similar accounts)", note),
    engagementRatio: unavailable("Observed / expected", note),
    likesPerPostMedian: unavailable("Median likes per post", note),
    commentsPerPostMedian: unavailable("Median comments per post", note),
    commentsToLikesRatio: unavailable("Comments per 100 likes", note),
    postsAnalyzed: 0,
    outlierPosts: [],
    qualityScore: unavailable("Engagement Quality Score", note),
    explanation: { title: "Why no engagement score?", summary: "Not enough observed post data.", drivers: missing.map((m) => ({ label: m, impact: 0, detail: "Missing input" })) },
  };
}

/**
 * Engagement analysis from observed public posts.
 * - engagement rate = median((likes+comments)/followers) over recent posts (robust to viral outliers)
 * - expected rate from follower-tier benchmark (estimated)
 * - anomalies: rate far above OR far below expected, comment/like ratio extremes, like-count outliers.
 */
export function analyzeEngagement(posts: PostData[], followers: number | undefined): EngagementAnalysis {
  const usable = posts.filter((p) => typeof p.likesCount === "number");
  const missing: string[] = [];
  if (!followers || followers <= 0) missing.push("Follower count");
  if (usable.length < 3) missing.push(`At least 3 public posts with like counts (have ${usable.length})`);
  if (missing.length) return insufficientEngagement(missing);
  const f = followers as number;

  const likes = usable.map((p) => p.likesCount as number);
  const comments = usable.map((p) => p.commentsCount ?? 0);
  const rates = usable.map((p) => (((p.likesCount as number) + (p.commentsCount ?? 0)) / f) * 100);
  const rate = median(rates);
  const tier = tierFor(f);
  const ratio = rate / tier.expectedRatePct;
  const medLikes = median(likes);
  const medComments = median(comments);
  const cpl = medLikes > 0 ? (medComments / medLikes) * 100 : 0;

  const outliers = detectOutliersRobust(likes, 3.5).map((o) => ({ id: usable[o.index]?.id ?? "?", likes: o.value, robustZ: round(o.robustZ, 2) }));

  // Quality score components (each 0..1 where 1 = anomalous)
  const tooHigh = softThreshold(ratio, 3.0, 0.6); // >3× expected is unusual (could be viral or inflated)
  const tooLow = softThreshold(-ratio, -0.25, 0.08); // <25% of expected: inflated followers / inactive audience
  const commentStarved = medLikes >= 200 ? softThreshold(-cpl, -0.15, 0.08) : 0; // <0.15 comments per 100 likes
  const commentFlood = softThreshold(cpl, 12, 3); // >12 comments per 100 likes is unusual
  const flatness = (() => {
    // like counts almost identical across posts (low dispersion) is a known purchased-likes fingerprint
    if (likes.length < 5) return 0;
    const med = median(likes);
    if (med === 0) return 0;
    const dev = median(likes.map((l) => Math.abs(l - med))) / med;
    return softThreshold(-dev, -0.04, 0.015); // MAD/median < 4%
  })();

  // Components are additive and clamped: two strong fingerprints (e.g. far-below benchmark + flat likes) are enough for a low score.
  const anomaly = clamp01(0.35 * tooHigh + 0.45 * tooLow + 0.2 * commentStarved + 0.15 * commentFlood + 0.35 * flatness);
  const quality = Math.round((1 - anomaly) * 100);

  const drivers = [
    { label: "Engagement vs expected", impact: round((0.35 * tooHigh + 0.45 * tooLow) * 100, 0), detail: `${round(rate, 2)}% observed vs ${tier.expectedRatePct}% typical for ${tier.label} followers (×${round(ratio, 2)})` },
    { label: "Comment / like balance", impact: round((0.2 * commentStarved + 0.15 * commentFlood) * 100, 0), detail: `${round(cpl, 2)} comments per 100 likes` },
    { label: "Like-count dispersion", impact: round(flatness * 35, 0), detail: flatness > 0.3 ? "Like counts are unusually uniform across posts" : "Like counts vary naturally across posts" },
    { label: "Outlier posts", impact: 0, detail: outliers.length ? `${outliers.length} post(s) with robust z ≥ 3.5` : "No like-count outliers" },
  ].filter((d) => d.impact > 0 || d.label === "Outlier posts" || d.label === "Engagement vs expected");

  return {
    status: "ok",
    missing: [],
    engagementRate: { label: "Engagement rate", status: "observed", value: round(rate, 2), unit: "percent", note: `Median of ${usable.length} posts: (likes+comments)/followers` },
    expectedEngagementRate: { label: "Expected engagement (similar accounts)", status: "estimated", value: tier.expectedRatePct, unit: "percent", interval: { low: round(Math.max(0, tier.expectedRatePct - tier.spreadPct), 1), high: round(tier.expectedRatePct + tier.spreadPct, 1) }, note: `Reference benchmark for ${tier.label} followers` },
    engagementRatio: { label: "Observed / expected", status: "estimated", value: round(ratio, 2), unit: "ratio" },
    likesPerPostMedian: { label: "Median likes per post", status: "observed", value: Math.round(medLikes), unit: "count" },
    commentsPerPostMedian: { label: "Median comments per post", status: "observed", value: Math.round(medComments), unit: "count" },
    commentsToLikesRatio: { label: "Comments per 100 likes", status: "observed", value: round(cpl, 2), unit: "ratio" },
    postsAnalyzed: usable.length,
    outlierPosts: outliers,
    qualityScore: { label: "Engagement Quality Score", status: "estimated", value: quality, unit: "score", note: "100 = engagement pattern consistent with an organic audience" },
    explanation: { title: "Why this engagement score?", summary: `Quality ${quality}/100. Observed engagement is ×${round(ratio, 2)} the benchmark for this follower tier.`, drivers },
  };
}
