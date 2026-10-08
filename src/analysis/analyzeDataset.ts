import type { DatasetAnalysisResult } from "@/types/results";
import type { SuspicionWeights } from "@/config/weights";
import type { ImportedDataset } from "@/utils/datasetImport";
import { analyzeAudience, insufficientAudience, MIN_SAMPLE_FOR_ESTIMATE } from "./followers/audienceAggregate";
import { analyzeComments, MIN_COMMENT_SAMPLE } from "./comments/commentAnalysis";
import { buildConfidence, sampleAdequacy, type FacetInput } from "./confidence/confidence";
import { PROFILE_DISCLAIMERS } from "./analyzeProfile";

export function analyzeDataset(ds: ImportedDataset, weights: SuspicionWeights, now = Date.now()): DatasetAnalysisResult {
  const base = {
    kind: "dataset" as const,
    analyzedAt: new Date(now).toISOString(),
    datasetType: ds.type,
    rowsReceived: ds.rowsReceived,
    rowsRejected: ds.rejected,
    disclaimers: [...PROFILE_DISCLAIMERS, "Imported datasets are processed in memory and are not stored."],
  };

  if (ds.type === "comments") {
    const comments = ds.comments ?? [];
    const n = comments.length;
    const sample = n > 0 ? { comments, meta: { sampleSize: n, populationSize: ds.totalComments, method: ds.method ?? "User-imported dataset", representative: false } } : undefined;
    const analysis = analyzeComments(ds.totalComments, sample, weights, undefined, now);
    const withTs = comments.filter((c) => c.createdAt).length;
    const withAuthor = comments.filter((c) => c.author).length;
    const facets: FacetInput[] = [
      { key: "comments", label: "Comment rows", weight: 0.5, availability: n >= MIN_COMMENT_SAMPLE ? sampleAdequacy(n, ds.totalComments) : 0, status: n >= MIN_COMMENT_SAMPLE ? "observed" : "unavailable", note: `${n} valid comments` },
      { key: "timestamps", label: "Comment timestamps", weight: 0.2, availability: n ? withTs / n : 0, status: withTs > 0 ? "observed" : "unavailable", note: `${withTs}/${n} rows` },
      { key: "authors", label: "Commenter profile data", weight: 0.3, availability: n ? withAuthor / n : 0, status: withAuthor > 0 ? "observed" : "unavailable", note: `${withAuthor}/${n} rows` },
    ];
    const { report, facets: facetList } = buildConfidence(facets, n, ds.totalComments);
    return { ...base, rowsAccepted: n, confidence: report, commentsAnalysis: analysis, facets: facetList };
  }

  const accounts = ds.accounts ?? [];
  const n = accounts.length;
  const audience = n > 0
    ? analyzeAudience({ accounts, meta: { sampleSize: n, populationSize: ds.populationSize, method: ds.method ?? "User-imported dataset", representative: false } }, weights, now)
    : insufficientAudience(["No valid account rows"]);
  const has = (k: keyof (typeof accounts)[number]) => accounts.filter((a) => a[k] !== undefined).length;
  const facets: FacetInput[] = [
    { key: "rows", label: "Account rows", weight: 0.4, availability: n >= MIN_SAMPLE_FOR_ESTIMATE ? sampleAdequacy(n, ds.populationSize) : 0, status: n >= MIN_SAMPLE_FOR_ESTIMATE ? "observed" : "unavailable", note: `${n} valid accounts` },
    { key: "counts", label: "Follower / following / post counts", weight: 0.3, availability: n ? (has("followersCount") + has("followingCount") + has("postsCount")) / (3 * n) : 0, status: has("followersCount") ? "observed" : "unavailable" },
    { key: "picture", label: "Profile picture flag", weight: 0.1, availability: n ? has("hasProfilePicture") / n : 0, status: has("hasProfilePicture") ? "observed" : "unavailable" },
    { key: "activity", label: "Last-post / creation dates", weight: 0.1, availability: n ? Math.max(has("lastPostAt"), has("createdAt")) / n : 0, status: has("lastPostAt") || has("createdAt") ? "observed" : "unavailable" },
    { key: "population", label: "Total follower count (for scaling)", weight: 0.1, availability: ds.populationSize ? 1 : 0, status: ds.populationSize ? "observed" : "unavailable", note: ds.populationSize ? undefined : "Add populationSize / followersTotal in JSON or the form" },
  ];
  const { report, facets: facetList } = buildConfidence(facets, n, ds.populationSize);
  return { ...base, rowsAccepted: n, confidence: report, audience, facets: facetList };
}
