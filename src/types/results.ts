/**
 * Analysis result types. Every number exposed to the UI is tagged as
 * OBSERVED, ESTIMATED or UNAVAILABLE so the presentation layer can never
 * confuse a measured fact with a model output.
 */

export type MetricStatus = "observed" | "estimated" | "unavailable";
export type ConfidenceLevel = "LOW" | "MEDIUM" | "HIGH";

export interface Interval {
  low: number;
  high: number;
}

export interface Metric {
  label: string;
  status: MetricStatus;
  /** point value (for observed) or point estimate (for estimated) */
  value?: number;
  /** estimation interval when it makes sense (percentages, counts) */
  interval?: Interval;
  unit?: "count" | "percent" | "score" | "ratio";
  /** reason when unavailable, or short note on how it was derived */
  note?: string;
}

export type SuspicionBand =
  | "Likely Authentic"
  | "Some Suspicious Signals"
  | "Highly Suspicious"
  | "Very High Suspicion";

export interface FeatureContribution {
  key: string;
  label: string;
  /** feature activation 0..1 */
  activation: number;
  weight: number;
  /** activation * weight */
  contribution: number;
  /** short explanation of why the feature fired */
  detail?: string;
}

export interface AccountScore {
  username: string;
  score: number; // 0..100
  band: SuspicionBand;
  activeSignals: number;
  contributions: FeatureContribution[];
  /** fraction of features that could be evaluated for this account (0..1) */
  featureCoverage: number;
}

export interface Signal {
  key: string;
  label: string;
  /** share (0..1) of total suspicious weight explained by this signal */
  share: number;
  /** fraction (0..1) of sampled accounts in which the signal fired */
  prevalence: number;
  description: string;
}

export interface ConfidenceReport {
  level: ConfidenceLevel;
  /** 0..1 — how much of the data the model wants was actually available */
  dataCoverage: number;
  sampleSize: number;
  populationSize?: number;
  /** sample / population when both known */
  samplingFraction?: number;
  reasons: string[];
}

export interface ScoreExplanation {
  title: string;
  summary: string;
  drivers: { label: string; impact: number; detail: string }[];
}

export interface DistributionBucket {
  label: string;
  from: number;
  to: number;
  count: number;
}

export interface AudienceAnalysis {
  status: "ok" | "insufficient";
  missing: string[];
  authenticityScore: Metric; // 0..100 (higher = more authentic)
  botFakeScore: Metric; // 0..100 (higher = more suspicious)
  realPct: Metric;
  suspiciousPct: Metric;
  botLikePct: Metric;
  inactivePct: Metric;
  massFollowingPct: Metric;
  realCount: Metric;
  suspiciousCount: Metric;
  bandDistribution: { band: SuspicionBand; count: number; pct: number }[];
  scoreHistogram: DistributionBucket[];
  signals: Signal[];
  accounts: AccountScore[];
  explanation: ScoreExplanation;
  sampleMeta?: { method: string; representative: boolean; sampleSize: number; populationSize?: number };
}

export interface EngagementAnalysis {
  status: "ok" | "insufficient";
  missing: string[];
  engagementRate: Metric; // percent
  expectedEngagementRate: Metric; // percent
  engagementRatio: Metric; // observed / expected
  likesPerPostMedian: Metric;
  commentsPerPostMedian: Metric;
  commentsToLikesRatio: Metric;
  postsAnalyzed: number;
  outlierPosts: { id: string; likes: number; robustZ: number }[];
  qualityScore: Metric; // 0..100
  explanation: ScoreExplanation;
}

export interface CommentAnalysis {
  status: "ok" | "insufficient";
  missing: string[];
  total: Metric;
  authenticCount: Metric;
  suspiciousCount: Metric;
  suspiciousPct: Metric;
  authenticityScore: Metric;
  signals: Signal[];
  duplicateGroups: { text: string; count: number; authors: number }[];
  temporalBursts: { start: string; end: string; count: number }[];
  flagged: { id: string; author: string; text: string; score: number; reasons: string[] }[];
  explanation: ScoreExplanation;
}

export interface LikesAnalysis {
  status: "ok" | "insufficient";
  missing: string[];
  total: Metric;
  authenticCount: Metric;
  suspiciousCount: Metric;
  suspiciousPct: Metric;
  authenticPct: Metric;
  signals: Signal[];
  sampleScores: AccountScore[];
  explanation: ScoreExplanation;
}

export interface DataFacet {
  key: string;
  label: string;
  status: MetricStatus;
  note?: string;
}

export interface ProfileAnalysisResult {
  kind: "profile";
  analyzedAt: string;
  provider: { name: string; isDemo: boolean };
  profile: {
    username: string;
    fullName?: string;
    isVerified?: boolean;
    isPrivate?: boolean;
    followers: Metric;
    following: Metric;
    posts: Metric;
    followRatio: Metric;
  };
  score?: number;
  confidence: ConfidenceReport;
  audience: AudienceAnalysis;
  engagement: EngagementAnalysis;
  posts: { id: string; kind: string; likes?: number; comments?: number; publishedAt?: string; url?: string }[];
  facets: DataFacet[];
  disclaimers: string[];
}

export interface PostAnalysisResult {
  kind: "post";
  analyzedAt: string;
  provider: { name: string; isDemo: boolean };
  post: {
    id: string;
    url?: string;
    kind: string;
    owner?: string;
    publishedAt?: string;
    likes: Metric;
    comments: Metric;
    views: Metric;
  };
  engagement: {
    rate: Metric;
    expectedRate: Metric;
    ratio: Metric;
    commentsToLikes: Metric;
    authenticityScore: Metric;
    explanation: ScoreExplanation;
  };
  likes: LikesAnalysis;
  commentsAnalysis: CommentAnalysis;
  overallScore: Metric;
  confidence: ConfidenceReport;
  facets: DataFacet[];
  disclaimers: string[];
}

export interface DatasetAnalysisResult {
  kind: "dataset";
  analyzedAt: string;
  datasetType: "accounts" | "comments";
  rowsReceived: number;
  rowsAccepted: number;
  rowsRejected: { row: number; reason: string }[];
  confidence: ConfidenceReport;
  audience?: AudienceAnalysis;
  commentsAnalysis?: CommentAnalysis;
  facets: DataFacet[];
  disclaimers: string[];
}

export type AnalysisResult = ProfileAnalysisResult | PostAnalysisResult | DatasetAnalysisResult;

export interface ApiEnvelope<T> {
  ok: true;
  score: number | null;
  confidence: ConfidenceLevel;
  dataCoverage: number;
  sampleSize: number;
  result: T;
}

export interface ApiError {
  ok: false;
  error: string;
  details?: unknown;
}
