import type { InstagramDataProvider } from "@/providers/types";
import type { ProfileAnalysisResult, Metric } from "@/types/results";
import type { SuspicionWeights } from "@/config/weights";
import { analyzeAudience, insufficientAudience, MIN_SAMPLE_FOR_ESTIMATE } from "./followers/audienceAggregate";
import { analyzeEngagement } from "./engagement/engagementAnalysis";
import { buildConfidence, sampleAdequacy, type FacetInput } from "./confidence/confidence";
import { combineScores } from "./scoring/combine";
import { round } from "./statistics";

export const PROFILE_DISCLAIMERS = [
  "All authenticity figures are ESTIMATES derived from detected signals, not verified facts.",
  "No single signal classifies an account as a bot; scores combine multiple weighted features.",
  "Estimates from small samples carry wide intervals and are labelled LOW confidence.",
  "Only data legitimately available from the active provider or user-supplied datasets is analyzed.",
];

function metric(label: string, value: number | undefined, unit: Metric["unit"], note?: string): Metric {
  return value === undefined ? { label, status: "unavailable", note: note ?? "Not provided by the data source" } : { label, status: "observed", value, unit };
}

export async function analyzeProfile(provider: InstagramDataProvider, username: string, weights: SuspicionWeights, now = Date.now()): Promise<ProfileAnalysisResult | { error: string; reason: string }> {
  const profileRes = await provider.getProfile(username);
  if (profileRes.status === "unavailable") return { error: "PROFILE_UNAVAILABLE", reason: profileRes.reason };
  const profile = profileRes.data;

  const [postsRes, sampleRes] = await Promise.all([
    profile.isPrivate ? Promise.resolve({ status: "unavailable" as const, reason: "Account is private", source: profileRes.source }) : provider.getPublicPosts(username, 25),
    profile.isPrivate ? Promise.resolve({ status: "unavailable" as const, reason: "Account is private", source: profileRes.source }) : provider.getFollowerSample(username, 1000),
  ]);

  const posts = postsRes.status === "available" ? postsRes.data : [];
  const engagement = postsRes.status === "available"
    ? analyzeEngagement(posts, profile.followersCount)
    : analyzeEngagement([], profile.followersCount);
  if (postsRes.status === "unavailable" && engagement.status === "insufficient") engagement.missing = [postsRes.reason, ...engagement.missing.filter((m) => !m.startsWith("At least"))];

  const audience = sampleRes.status === "available"
    ? analyzeAudience(sampleRes.data, weights, now)
    : insufficientAudience([sampleRes.reason]);

  const sampleSize = sampleRes.status === "available" ? sampleRes.data.accounts.length : 0;
  const facets: FacetInput[] = [
    { key: "profile", label: "Profile counts", weight: 0.15, availability: profile.followersCount !== undefined ? 1 : 0, status: profile.followersCount !== undefined ? "observed" : "unavailable" },
    { key: "posts", label: "Public posts", weight: 0.2, availability: postsRes.status === "available" ? Math.min(1, posts.length / 12) : 0, status: postsRes.status === "available" ? "observed" : "unavailable", note: postsRes.status === "unavailable" ? postsRes.reason : `${posts.length} posts` },
    { key: "followerSample", label: "Follower sample", weight: 0.5, availability: sampleRes.status === "available" ? sampleAdequacy(sampleSize, profile.followersCount) : 0, status: sampleRes.status === "available" ? (sampleSize >= MIN_SAMPLE_FOR_ESTIMATE ? "observed" : "unavailable") : "unavailable", note: sampleRes.status === "available" ? `${sampleSize} accounts (${sampleRes.data.meta.method})` : sampleRes.reason },
    { key: "engagementQuality", label: "Engagement quality model", weight: 0.15, availability: engagement.status === "ok" ? 1 : 0, status: engagement.status === "ok" ? "estimated" : "unavailable" },
  ];
  const { report: confidence, facets: facetList } = buildConfidence(facets, sampleSize, profile.followersCount);

  const combined = combineScores([
    { label: "Audience authenticity", score: audience.authenticityScore.value, weight: 0.6 },
    { label: "Engagement quality", score: engagement.qualityScore.value, weight: 0.4 },
  ], 0.5); // audience component is required: engagement alone never yields an overall score

  const ratio = profile.followersCount !== undefined && profile.followingCount !== undefined ? round(profile.followingCount / Math.max(1, profile.followersCount), 3) : undefined;

  return {
    kind: "profile",
    analyzedAt: new Date(now).toISOString(),
    provider: { name: provider.name, isDemo: provider.isDemo },
    profile: {
      username: profile.username,
      fullName: profile.fullName,
      isVerified: profile.isVerified,
      isPrivate: profile.isPrivate,
      followers: metric("Followers", profile.followersCount, "count"),
      following: metric("Following", profile.followingCount, "count"),
      posts: metric("Posts", profile.postsCount, "count"),
      followRatio: ratio === undefined ? { label: "Following / followers", status: "unavailable" } : { label: "Following / followers", status: "observed", value: ratio, unit: "ratio" },
    },
    score: combined.score.value,
    confidence,
    audience,
    engagement,
    posts: posts.map((p) => ({ id: p.id, kind: p.kind, likes: p.likesCount, comments: p.commentsCount, publishedAt: p.publishedAt, url: p.url })),
    facets: facetList,
    disclaimers: PROFILE_DISCLAIMERS,
  };
}
