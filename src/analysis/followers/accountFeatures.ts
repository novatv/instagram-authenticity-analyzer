import type { AccountSample } from "@/types/domain";
import type { FeatureKey } from "@/config/weights";
import { clamp01, softThreshold, normalizedEntropy } from "@/analysis/statistics";

export interface FeatureActivation {
  key: FeatureKey;
  /** 0..1, or null when the feature cannot be evaluated for this account */
  activation: number | null;
  detail?: string;
}

const DAY_MS = 86_400_000;

function daysBetween(fromIso: string | undefined, now: number): number | null {
  if (!fromIso) return null;
  const t = Date.parse(fromIso);
  if (!Number.isFinite(t)) return null;
  return (now - t) / DAY_MS;
}

/** Username anomaly: combination of digit runs, generated tokens and low entropy. */
export function usernameAnomaly(username: string): { activation: number; detail?: string } {
  const u = username.toLowerCase().replace(/^@/, "");
  if (!u) return { activation: 0 };
  const reasons: string[] = [];
  let score = 0;

  const longestDigitRun = Math.max(0, ...(u.match(/\d+/g) ?? []).map((m) => m.length));
  if (longestDigitRun >= 6) {
    score += 0.55;
    reasons.push(`${longestDigitRun}-digit sequence`);
  } else if (longestDigitRun >= 4) {
    score += 0.3;
    reasons.push(`${longestDigitRun}-digit sequence`);
  }

  const digitShare = (u.match(/\d/g) ?? []).length / u.length;
  if (digitShare >= 0.5) {
    score += 0.25;
    reasons.push("mostly digits");
  }

  // generated-looking: word + digits + random letters, e.g. "user_8f3k2a91"
  if (/^(user|insta|ig|account|profile)[._-]?[a-z0-9]{5,}$/.test(u)) {
    score += 0.35;
    reasons.push("generic prefix + token");
  }

  // many separators
  const separators = (u.match(/[._]/g) ?? []).length;
  if (separators >= 3) {
    score += 0.15;
    reasons.push("many separators");
  }

  // Very low entropy (e.g. "aaaaaaa1") or extremely high for length (random hash-like)
  const letters = u.replace(/[^a-z]/g, "");
  if (letters.length >= 6) {
    const ent = normalizedEntropy(letters);
    if (ent < 0.45) {
      score += 0.2;
      reasons.push("repetitive characters");
    }
    // consonant-only random strings
    const vowelShare = (letters.match(/[aeiouy]/g) ?? []).length / letters.length;
    if (letters.length >= 8 && vowelShare < 0.12) {
      score += 0.25;
      reasons.push("unpronounceable token");
    }
  }

  return { activation: clamp01(score), detail: reasons.length ? reasons.join(", ") : undefined };
}

/**
 * Extract all feature activations for one sampled account.
 * A feature returns `null` when the input needed is not observed, so the
 * scorer can compute coverage honestly rather than assuming "0 = fine".
 */
export function extractAccountFeatures(a: AccountSample, now = Date.now()): FeatureActivation[] {
  const f: FeatureActivation[] = [];
  const followers = a.followersCount;
  const following = a.followingCount;
  const posts = a.postsCount;

  // ratioAnomaly: log10((following+1)/(followers+1)); 0 at ratio 1, ~1 at ratio 100+
  if (typeof followers === "number" && typeof following === "number") {
    const logRatio = Math.log10((following + 1) / (followers + 1));
    const act = softThreshold(logRatio, 1.0, 0.35); // ratio 10 => 0.5, ratio 100 => ~0.95
    f.push({
      key: "ratioAnomaly",
      activation: act,
      detail: `following/followers ≈ ${((following + 1) / (followers + 1)).toFixed(1)}`,
    });
  } else f.push({ key: "ratioAnomaly", activation: null });

  // massFollowing: following very high and followers tiny
  if (typeof followers === "number" && typeof following === "number") {
    const highFollowing = softThreshold(following, 1500, 400);
    const tinyFollowers = softThreshold(-followers, -150, 60); // followers < 150
    const act = clamp01(highFollowing * tinyFollowers);
    f.push({
      key: "massFollowing",
      activation: act,
      detail: act > 0.3 ? `follows ${following}, followed by ${followers}` : undefined,
    });
  } else f.push({ key: "massFollowing", activation: null });

  // emptyProfile / lowPosts
  if (typeof posts === "number") {
    f.push({ key: "emptyProfile", activation: posts === 0 ? 1 : 0, detail: posts === 0 ? "0 posts" : undefined });
    const low = posts === 0 ? 0 : posts <= 2 ? 1 : posts <= 5 ? 0.5 : 0;
    f.push({ key: "lowPosts", activation: low, detail: low > 0 ? `${posts} posts` : undefined });
  } else {
    f.push({ key: "emptyProfile", activation: null });
    f.push({ key: "lowPosts", activation: null });
  }

  // noProfilePicture
  if (typeof a.hasProfilePicture === "boolean") {
    f.push({ key: "noProfilePicture", activation: a.hasProfilePicture ? 0 : 1 });
  } else f.push({ key: "noProfilePicture", activation: null });

  // usernamePattern (always evaluable)
  const ua = usernameAnomaly(a.username);
  f.push({ key: "usernamePattern", activation: ua.activation, detail: ua.detail });

  // inactivity
  const sinceLast = daysBetween(a.lastPostAt, now);
  if (sinceLast !== null) {
    const act = softThreshold(sinceLast, 365, 90);
    f.push({ key: "inactivity", activation: act, detail: act > 0.3 ? `${Math.round(sinceLast)} days since last post` : undefined });
  } else if (typeof posts === "number" && posts === 0) {
    // no posts at all: inactivity can't be measured from timestamps; leave null to avoid double counting
    f.push({ key: "inactivity", activation: null });
  } else f.push({ key: "inactivity", activation: null });

  // noBio
  if (typeof a.hasBio === "boolean") f.push({ key: "noBio", activation: a.hasBio ? 0 : 1 });
  else f.push({ key: "noBio", activation: null });

  // newAccountHighFollowing
  const age = daysBetween(a.createdAt, now);
  if (age !== null && typeof following === "number") {
    const young = softThreshold(-age, -60, 20); // < 60 days
    const high = softThreshold(following, 800, 250);
    const act = clamp01(young * high);
    f.push({ key: "newAccountHighFollowing", activation: act, detail: act > 0.3 ? `${Math.round(age)} days old, follows ${following}` : undefined });
  } else f.push({ key: "newAccountHighFollowing", activation: null });

  // lowActivityCombo: statistically anomalous combination
  if (typeof posts === "number" && typeof following === "number" && typeof a.hasProfilePicture === "boolean") {
    const act = posts === 0 && !a.hasProfilePicture && following >= 300 ? 1 : 0;
    f.push({ key: "lowActivityCombo", activation: act, detail: act ? "no posts + no picture + high following" : undefined });
  } else f.push({ key: "lowActivityCombo", activation: null });

  return f;
}
