/**
 * Configurable weights for the follower / account suspicion model.
 * Each feature produces an activation in 0..1; the score is the weighted
 * average of activations over the features that could be evaluated,
 * damped when only a single signal fires (one signal never classifies).
 *
 * Override at runtime with SUSPICION_WEIGHTS_JSON or per-request `weights`.
 */

export const FEATURE_KEYS = [
  "ratioAnomaly",
  "massFollowing",
  "emptyProfile",
  "lowPosts",
  "noProfilePicture",
  "usernamePattern",
  "inactivity",
  "noBio",
  "newAccountHighFollowing",
  "lowActivityCombo",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export type SuspicionWeights = Record<FeatureKey, number>;

export const DEFAULT_SUSPICION_WEIGHTS: SuspicionWeights = {
  ratioAnomaly: 2.0,
  massFollowing: 2.0,
  emptyProfile: 1.6,
  lowPosts: 0.8,
  noProfilePicture: 1.2,
  usernamePattern: 0.9,
  inactivity: 1.2,
  noBio: 0.4,
  newAccountHighFollowing: 1.3,
  lowActivityCombo: 1.5,
};

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  ratioAnomaly: "Abnormal following ratio",
  massFollowing: "Mass-follow pattern",
  emptyProfile: "Near-empty profile",
  lowPosts: "Very few posts",
  noProfilePicture: "No profile picture",
  usernamePattern: "Username anomaly",
  inactivity: "Inactivity signals",
  noBio: "No biography",
  newAccountHighFollowing: "New account, high following",
  lowActivityCombo: "Low activity combination",
};

export const FEATURE_DESCRIPTIONS: Record<FeatureKey, string> = {
  ratioAnomaly: "Follows far more accounts than follow it back (log ratio well above typical).",
  massFollowing: "Follows thousands of accounts while having very few followers.",
  emptyProfile: "No public posts at all.",
  lowPosts: "Fewer than a handful of posts.",
  noProfilePicture: "Default avatar / no profile picture (only when the source reports it).",
  usernamePattern: "Long digit sequences, generated-looking tokens or very low character entropy.",
  inactivity: "No posts for a long time (requires last-post date).",
  noBio: "Empty biography (weak signal, low weight).",
  newAccountHighFollowing: "Recently created account already following a large number of accounts.",
  lowActivityCombo: "Statistically anomalous combination: no posts AND no picture AND high following.",
};

/** Classification bands as specified. */
export function bandFor(score: number): import("@/types/results").SuspicionBand {
  if (score <= 25) return "Likely Authentic";
  if (score <= 50) return "Some Suspicious Signals";
  if (score <= 75) return "Highly Suspicious";
  return "Very High Suspicion";
}

export function mergeWeights(
  overrides?: Partial<Record<string, number>> | null,
): SuspicionWeights {
  const w: SuspicionWeights = { ...DEFAULT_SUSPICION_WEIGHTS };
  if (!overrides) return w;
  for (const key of FEATURE_KEYS) {
    const v = overrides[key];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 10) w[key] = v;
  }
  return w;
}

/** Reads SUSPICION_WEIGHTS_JSON from the environment, ignoring invalid input. */
export function weightsFromEnv(): SuspicionWeights {
  const raw = process.env.SUSPICION_WEIGHTS_JSON;
  if (!raw) return { ...DEFAULT_SUSPICION_WEIGHTS };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") return mergeWeights(parsed as Record<string, number>);
  } catch {
    /* ignore malformed env */
  }
  return { ...DEFAULT_SUSPICION_WEIGHTS };
}
