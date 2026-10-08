import type { InstagramDataProvider } from "@/providers/types";
import type { PostAnalysisResult, Metric, ScoreExplanation } from "@/types/results";
import type { SuspicionWeights } from "@/config/weights";
import { analyzeLikes, MIN_LIKER_SAMPLE } from "./engagement/likesAnalysis";
import { analyzeComments, MIN_COMMENT_SAMPLE } from "./comments/commentAnalysis";
import { tierFor } from "./engagement/benchmarks";
import { buildConfidence, sampleAdequacy, type FacetInput } from "./confidence/confidence";
import { combineScores } from "./scoring/combine";
import { round, softThreshold, clamp01 } from "./statistics";
import { PROFILE_DISCLAIMERS } from "./analyzeProfile";

function obs(label: string, value: number | undefined, unit: Metric["unit"], note?: string): Metric {
  return value === undefined ? { label, status: "unavailable", note: note ?? "Not exposed by the data source (hidden or unavailable)" } : { label, status: "observed", value, unit };
}

export async function analyzePost(provider: InstagramDataProvider, ref: { shortcode: string; url: string }, weights: SuspicionWeights, now = Date.now()): Promise<PostAnalysisResult | { error: string; reason: string }> {
  const postRes = await provider.getPost(ref);
  if (postRes.status === "unavailable") return { error: "POST_UNAVAILABLE", reason: postRes.reason };
  const post = postRes.data;

  const [ownerRes, likersRes, commentsRes] = await Promise.all([
    post.ownerUsername ? provider.getProfile(post.ownerUsername) : Promise.resolve(null),
    provider.getLikers(post.shortcode ?? post.id, 500),
    provider.getComments(post.shortcode ?? post.id, 500),
  ]);
  const followers = ownerRes && ownerRes.status === "available" ? ownerRes.data.followersCount : undefined;

  // Engagement for the single post
  let rate: Metric;
  let expected: Metric;
  let ratioM: Metric;
  let engScore: Metric;
  let engExpl: ScoreExplanation;
  const likes = post.likesCount;
  const comments = post.commentsCount;
  const cpl = typeof likes === "number" && likes > 0 && typeof comments === "number" ? round((comments / likes) * 100, 2) : undefined;
  if (typeof likes === "number" && followers) {
    const r = ((likes + (comments ?? 0)) / followers) * 100;
    const tier = tierFor(followers);
    const ratio = r / tier.expectedRatePct;
    const tooHigh = softThreshold(ratio, 4, 0.8);
    const tooLow = softThreshold(-ratio, -0.2, 0.06);
    const starved = likes >= 200 && cpl !== undefined ? softThreshold(-cpl, -0.15, 0.08) : 0;
    const anomaly = clamp01(0.4 * tooHigh + 0.4 * tooLow + 0.2 * starved);
    const score = Math.round((1 - anomaly) * 100);
    rate = { label: "Engagement rate", status: "observed", value: round(r, 2), unit: "percent", note: "(likes + comments) / owner followers" };
    expected = { label: "Expected engagement (similar accounts)", status: "estimated", value: tier.expectedRatePct, unit: "percent", interval: { low: round(Math.max(0, tier.expectedRatePct - tier.spreadPct), 1), high: round(tier.expectedRatePct + tier.spreadPct, 1) }, note: `Reference for ${tier.label} followers` };
    ratioM = { label: "Observed / expected", status: "estimated", value: round(ratio, 2), unit: "ratio" };
    engScore = { label: "Engagement Authenticity Score", status: "estimated", value: score, unit: "score" };
    engExpl = {
      title: "Why this engagement score?",
      summary: `Post engagement ${round(r, 2)}% is ×${round(ratio, 2)} the benchmark for a ${tier.label}-follower account.`,
      drivers: [
        { label: "Engagement vs expected", impact: Math.round((tooHigh + tooLow) * 80), detail: `×${round(ratio, 2)} of benchmark` },
        { label: "Comments per 100 likes", impact: Math.round(starved * 20), detail: cpl === undefined ? "Comment count unavailable" : `${cpl} (very low values can indicate purchased likes)` },
      ],
    };
  } else {
    const missing = typeof likes !== "number" ? "like count" : "owner follower count";
    rate = { label: "Engagement rate", status: "unavailable", note: `Requires ${missing}` };
    expected = { label: "Expected engagement (similar accounts)", status: "unavailable", note: "Requires owner follower count" };
    ratioM = { label: "Observed / expected", status: "unavailable", note: `Requires ${missing}` };
    engScore = { label: "Engagement Authenticity Score", status: "unavailable", note: `Requires ${missing}` };
    engExpl = { title: "Why no engagement score?", summary: `Missing ${missing}.`, drivers: [] };
  }

  const likesAnalysis = analyzeLikes(likes, likersRes.status === "available" ? likersRes.data : undefined, weights, now);
  if (likersRes.status === "unavailable") likesAnalysis.missing = [likersRes.reason, ...likesAnalysis.missing.filter((m) => !m.startsWith("Sample of"))];
  const commentAnalysis = analyzeComments(comments, commentsRes.status === "available" ? commentsRes.data : undefined, weights, undefined, now);
  if (commentsRes.status === "unavailable") commentAnalysis.missing = [commentsRes.reason, ...commentAnalysis.missing.filter((m) => !m.startsWith("Sample of"))];

  const likerN = likersRes.status === "available" ? likersRes.data.accounts.length : 0;
  const commentN = commentsRes.status === "available" ? commentsRes.data.comments.length : 0;
  const facets: FacetInput[] = [
    { key: "postCounts", label: "Post like/comment counts", weight: 0.2, availability: typeof likes === "number" ? 1 : 0, status: typeof likes === "number" ? "observed" : "unavailable" },
    { key: "owner", label: "Owner follower count", weight: 0.1, availability: followers ? 1 : 0, status: followers ? "observed" : "unavailable", note: ownerRes && ownerRes.status === "unavailable" ? ownerRes.reason : undefined },
    { key: "likers", label: "Liker sample", weight: 0.35, availability: likerN >= MIN_LIKER_SAMPLE ? sampleAdequacy(likerN, likes) : 0, status: likerN >= MIN_LIKER_SAMPLE ? "observed" : "unavailable", note: likersRes.status === "available" ? `${likerN} accounts` : likersRes.reason },
    { key: "comments", label: "Comment sample", weight: 0.35, availability: commentN >= MIN_COMMENT_SAMPLE ? sampleAdequacy(commentN, comments) : 0, status: commentN >= MIN_COMMENT_SAMPLE ? "observed" : "unavailable", note: commentsRes.status === "available" ? `${commentN} comments` : commentsRes.reason },
  ];
  const { report: confidence, facets: facetList } = buildConfidence(facets, likerN + commentN, (likes ?? 0) + (comments ?? 0) || undefined);

  const overall = combineScores([
    { label: "Like authenticity", score: likesAnalysis.status === "ok" ? Math.round(100 - (likesAnalysis.suspiciousPct.value ?? 0)) : undefined, weight: 0.4 },
    { label: "Comment authenticity", score: commentAnalysis.authenticityScore.value, weight: 0.35 },
    { label: "Engagement pattern", score: engScore.value, weight: 0.25 },
  ], 0.3);

  return {
    kind: "post",
    analyzedAt: new Date(now).toISOString(),
    provider: { name: provider.name, isDemo: provider.isDemo },
    post: {
      id: post.shortcode ?? post.id,
      url: post.url ?? ref.url,
      kind: post.kind,
      owner: post.ownerUsername,
      publishedAt: post.publishedAt,
      likes: obs("Likes", likes, "count"),
      comments: obs("Comments", comments, "count"),
      views: obs("Views", post.viewsCount, "count", "Views are only reported for reels/videos"),
    },
    engagement: {
      rate,
      expectedRate: expected,
      ratio: ratioM,
      commentsToLikes: cpl === undefined ? { label: "Comments per 100 likes", status: "unavailable" } : { label: "Comments per 100 likes", status: "observed", value: cpl, unit: "ratio" },
      authenticityScore: engScore,
      explanation: engExpl,
    },
    likes: likesAnalysis,
    commentsAnalysis: commentAnalysis,
    overallScore: { ...overall.score, label: "Overall Post Authenticity Score" },
    confidence,
    facets: facetList,
    disclaimers: [...PROFILE_DISCLAIMERS, "Like/comment authenticity is estimated from account samples; totals are scaled with 95% intervals."],
  };
}

export { combineScores };
