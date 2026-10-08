/**
 * Reference engagement benchmarks by follower tier.
 * These are approximate industry reference values (engagement = (likes+comments)/followers)
 * used ONLY to produce an "expected engagement for similar accounts" estimate.
 * They are clearly labelled as estimated in the UI.
 */
export interface Tier {
  maxFollowers: number;
  label: string;
  expectedRatePct: number;
  /** typical spread used to judge anomalies */
  spreadPct: number;
}

export const ENGAGEMENT_TIERS: Tier[] = [
  { maxFollowers: 1_000, label: "< 1K", expectedRatePct: 8.0, spreadPct: 4.0 },
  { maxFollowers: 10_000, label: "1K – 10K", expectedRatePct: 4.0, spreadPct: 2.0 },
  { maxFollowers: 100_000, label: "10K – 100K", expectedRatePct: 2.4, spreadPct: 1.2 },
  { maxFollowers: 1_000_000, label: "100K – 1M", expectedRatePct: 1.7, spreadPct: 0.9 },
  { maxFollowers: Infinity, label: "> 1M", expectedRatePct: 1.2, spreadPct: 0.7 },
];

export function tierFor(followers: number): Tier {
  return ENGAGEMENT_TIERS.find((t) => followers < t.maxFollowers) ?? (ENGAGEMENT_TIERS[ENGAGEMENT_TIERS.length - 1] as Tier);
}
