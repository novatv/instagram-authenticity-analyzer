import { describe, it, expect } from "vitest";
import { scoreAccount } from "@/analysis/followers/suspicionScore";
import { usernameAnomaly, extractAccountFeatures } from "@/analysis/followers/accountFeatures";
import { DEFAULT_SUSPICION_WEIGHTS, bandFor, mergeWeights } from "@/config/weights";
import { analyzeAudience, MIN_SAMPLE_FOR_ESTIMATE } from "@/analysis/followers/audienceAggregate";
import { synthAccounts } from "@/data/demoDataset";

const NOW = Date.parse("2026-10-08T12:00:00Z");
const W = DEFAULT_SUSPICION_WEIGHTS;

describe("username anomaly", () => {
  it("does not flag ordinary names with a couple of digits", () => {
    expect(usernameAnomaly("maria.garcia92").activation).toBeLessThan(0.3);
    expect(usernameAnomaly("dj_casanova").activation).toBe(0);
  });
  it("flags long digit runs and generated tokens", () => {
    expect(usernameAnomaly("ana48291037").activation).toBeGreaterThan(0.5);
    expect(usernameAnomaly("user_k3j9x2m1q").activation).toBeGreaterThan(0.3);
  });
});

describe("single signal never classifies", () => {
  it("a real-looking account with only a numeric username stays Likely Authentic", () => {
    const s = scoreAccount({ username: "pablo19930412", followersCount: 800, followingCount: 600, postsCount: 120, hasProfilePicture: true, hasBio: true, lastPostAt: new Date(NOW - 5 * 86_400_000).toISOString() }, W, NOW);
    expect(s.activeSignals).toBeLessThanOrEqual(1);
    expect(s.band).toBe("Likely Authentic");
  });
  it("an account with zero posts but otherwise normal is at most 'Some Suspicious Signals'", () => {
    const s = scoreAccount({ username: "lurker.vera", followersCount: 300, followingCount: 350, postsCount: 0, hasProfilePicture: true, hasBio: true }, W, NOW);
    expect(s.score).toBeLessThanOrEqual(50);
  });
});

describe("multi-signal bot-like accounts", () => {
  it("scores a textbook mass-follow empty profile as Highly Suspicious or worse", () => {
    const s = scoreAccount({ username: "user_8f3k2a91x", followersCount: 3, followingCount: 5400, postsCount: 0, hasProfilePicture: false, hasBio: false, createdAt: new Date(NOW - 10 * 86_400_000).toISOString() }, W, NOW);
    expect(s.score).toBeGreaterThan(50);
    expect(s.activeSignals).toBeGreaterThanOrEqual(3);
    expect(s.contributions[0]!.contribution).toBeGreaterThan(0);
  });
  it("reports feature coverage honestly when fields are missing", () => {
    const sparse = scoreAccount({ username: "someone" }, W, NOW);
    expect(sparse.featureCoverage).toBeLessThan(0.3);
    const full = extractAccountFeatures({ username: "x", followersCount: 1, followingCount: 1, postsCount: 1, hasProfilePicture: true, hasBio: true, lastPostAt: "2026-01-01", createdAt: "2020-01-01" }, NOW);
    expect(full.every((f) => f.activation !== null)).toBe(true);
  });
});

describe("weights", () => {
  it("bands follow the spec", () => {
    expect(bandFor(0)).toBe("Likely Authentic");
    expect(bandFor(25)).toBe("Likely Authentic");
    expect(bandFor(26)).toBe("Some Suspicious Signals");
    expect(bandFor(51)).toBe("Highly Suspicious");
    expect(bandFor(76)).toBe("Very High Suspicion");
  });
  it("mergeWeights ignores invalid overrides", () => {
    const w = mergeWeights({ ratioAnomaly: 5, usernamePattern: -1, bogus: 3 } as Record<string, number>);
    expect(w.ratioAnomaly).toBe(5);
    expect(w.usernamePattern).toBe(DEFAULT_SUSPICION_WEIGHTS.usernamePattern);
  });
  it("changing weights changes scores", () => {
    const acc = { username: "user_8f3k2a91x", followersCount: 3, followingCount: 5400, postsCount: 0, hasProfilePicture: false };
    const a = scoreAccount(acc, W, NOW).score;
    const b = scoreAccount(acc, mergeWeights({ massFollowing: 0, ratioAnomaly: 0 }), NOW).score;
    expect(b).not.toBe(a);
  });
});

describe("audience aggregation", () => {
  it("refuses to extrapolate from tiny samples", () => {
    const accounts = synthAccounts("tiny", MIN_SAMPLE_FOR_ESTIMATE - 1, 0.5, 0.1, NOW);
    const res = analyzeAudience({ accounts, meta: { sampleSize: accounts.length, method: "test", representative: true } }, W, NOW);
    expect(res.status).toBe("insufficient");
    expect(res.botFakeScore.status).toBe("unavailable");
  });
  it("separates a clean audience from an inflated one, with intervals", () => {
    const clean = analyzeAudience({ accounts: synthAccounts("clean", 500, 0.03, 0.05, NOW), meta: { sampleSize: 500, populationSize: 50_000, method: "test", representative: true } }, W, NOW);
    const dirty = analyzeAudience({ accounts: synthAccounts("dirty", 500, 0.5, 0.2, NOW), meta: { sampleSize: 500, populationSize: 50_000, method: "test", representative: true } }, W, NOW);
    expect(clean.status).toBe("ok");
    expect(dirty.status).toBe("ok");
    expect((dirty.botFakeScore.value as number) - (clean.botFakeScore.value as number)).toBeGreaterThan(25);
    expect(dirty.botLikePct.interval!.low).toBeLessThan(dirty.botLikePct.value!);
    expect(dirty.botLikePct.interval!.high).toBeGreaterThan(dirty.botLikePct.value!);
    expect(dirty.suspiciousCount.status).toBe("estimated");
    expect(dirty.signals.length).toBeGreaterThan(0);
    expect(dirty.signals.reduce((a, s) => a + s.share, 0)).toBeCloseTo(1, 5);
    expect(dirty.scoreHistogram.reduce((a, b) => a + b.count, 0)).toBe(500);
  });
  it("marks counts unavailable without a population size", () => {
    const res = analyzeAudience({ accounts: synthAccounts("nopop", 100, 0.2, 0.1, NOW), meta: { sampleSize: 100, method: "test", representative: false } }, W, NOW);
    expect(res.realCount.status).toBe("unavailable");
    expect(res.realPct.status).toBe("estimated");
  });
});
