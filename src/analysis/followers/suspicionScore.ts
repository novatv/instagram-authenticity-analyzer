import type { AccountSample } from "@/types/domain";
import type { AccountScore, FeatureContribution } from "@/types/results";
import { FEATURE_KEYS, FEATURE_LABELS, bandFor, type SuspicionWeights } from "@/config/weights";
import { extractAccountFeatures } from "./accountFeatures";
import { clamp01 } from "@/analysis/statistics";

const ACTIVE_THRESHOLD = 0.3;

/**
 * Weighted multi-feature suspicion score, normalized 0..100.
 *
 * score = Σ(activation_i × weight_i) / Σ(weight_i over evaluable features)
 *
 * Damping: a single active signal can at most contribute 50% of its weight,
 * so one signal alone never pushes an account beyond the lower bands.
 * Two signals → 75%, three or more → 100%.
 */
export function scoreAccount(
  account: AccountSample,
  weights: SuspicionWeights,
  now = Date.now(),
): AccountScore {
  const feats = extractAccountFeatures(account, now);
  const contributions: FeatureContribution[] = [];
  let weightedSum = 0;
  let weightTotal = 0;
  let evaluable = 0;
  let active = 0;

  for (const feat of feats) {
    const weight = weights[feat.key];
    if (feat.activation === null) continue;
    evaluable++;
    weightTotal += weight;
    const contribution = feat.activation * weight;
    weightedSum += contribution;
    if (feat.activation >= ACTIVE_THRESHOLD) active++;
    if (contribution > 0) {
      contributions.push({
        key: feat.key,
        label: FEATURE_LABELS[feat.key],
        activation: feat.activation,
        weight,
        contribution,
        detail: feat.detail,
      });
    }
  }

  const damping = active <= 1 ? 0.5 : active === 2 ? 0.75 : 1;
  const raw = weightTotal > 0 ? weightedSum / weightTotal : 0;
  const score = Math.round(clamp01(raw * damping) * 100);
  contributions.sort((a, b) => b.contribution - a.contribution);

  return {
    username: account.username,
    score,
    band: bandFor(score),
    activeSignals: active,
    contributions,
    featureCoverage: evaluable / FEATURE_KEYS.length,
  };
}

export function scoreAccounts(accounts: AccountSample[], weights: SuspicionWeights, now = Date.now()): AccountScore[] {
  return accounts.map((a) => scoreAccount(a, weights, now));
}
