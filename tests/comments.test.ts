import { describe, it, expect } from "vitest";
import { analyzeComments, MIN_COMMENT_SAMPLE } from "@/analysis/comments/commentAnalysis";
import { normalizeComment, jaccard, shingles, emojiStats, isGenericPhrase, spamScore, mentionCount } from "@/analysis/comments/commentFeatures";
import { DEFAULT_SUSPICION_WEIGHTS } from "@/config/weights";
import type { CommentData } from "@/types/domain";

const NOW = Date.parse("2026-10-08T12:00:00Z");

describe("comment features", () => {
  it("normalizes punctuation and case", () => {
    expect(normalizeComment("  Nice  PIC!!! ")).toBe("nice pic");
  });
  it("near-duplicate similarity", () => {
    const a = shingles("This set was incredible, amazing night");
    const b = shingles("This set was incredible, amazing night!!");
    expect(jaccard(a, b)).toBeGreaterThan(0.8);
    expect(jaccard(a, shingles("Where was this filmed?"))).toBeLessThan(0.3);
  });
  it("emoji and spam patterns", () => {
    expect(emojiStats("😍😍😍😍😍").repeatedEmojiRun).toBe(true);
    expect(emojiStats("🔥").emojiOnly).toBe(true);
    expect(isGenericPhrase("Nice pic")).toBe(true);
    expect(isGenericPhrase("the transition at 1:20 gave me chills")).toBe(false);
    expect(spamScore("DM me for promo").score).toBeGreaterThan(0);
    expect(spamScore("loved the set").score).toBe(0);
    expect(mentionCount("@a @bb @ccc look")).toBe(3);
  });
});

function mk(id: number, author: string, text: string, t?: number): CommentData {
  return { id: `c${id}`, authorUsername: author, text, createdAt: t ? new Date(t).toISOString() : undefined };
}

describe("comment analysis", () => {
  it("requires a minimum sample", () => {
    const r = analyzeComments(100, { comments: [mk(1, "a", "hi")], meta: { sampleSize: 1, method: "t", representative: true } }, DEFAULT_SUSPICION_WEIGHTS, undefined, NOW);
    expect(r.status).toBe("insufficient");
    expect(r.missing[0]).toContain(`${MIN_COMMENT_SAMPLE}`);
  });
  it("does not flag short genuine comments as fake", () => {
    const comments = Array.from({ length: 12 }, (_, i) => mk(i, `person${i}`, ["ok", "lol", "🔥", "jaja", "yes", "wow this", "nice one mate", "so good", "haha", "oh", "cool", "bro"][i]!, NOW - i * 3_600_000));
    const r = analyzeComments(12, { comments, meta: { sampleSize: 12, method: "t", representative: true } }, DEFAULT_SUSPICION_WEIGHTS, undefined, NOW);
    expect(r.status).toBe("ok");
    expect(r.suspiciousPct.value).toBeLessThan(20);
  });
  it("detects duplicates from multiple accounts, bursts and repeat authors", () => {
    const real = Array.from({ length: 15 }, (_, i) => mk(i, `real${i}`, `Genuinely loved the part at minute ${i}, where was it filmed?`, NOW - (i + 1) * 3_600_000));
    const dupes = Array.from({ length: 10 }, (_, i) => mk(100 + i, `bot${i}`, "Nice pic check my page", NOW - 60_000 + i * 1_000));
    const repeat = Array.from({ length: 4 }, (_, i) => mk(200 + i, "spammer_x", `Follow me for promo ${i}`, NOW - 30_000 + i * 500));
    const r = analyzeComments(29, { comments: [...real, ...dupes, ...repeat], meta: { sampleSize: 29, method: "t", representative: true } }, DEFAULT_SUSPICION_WEIGHTS, undefined, NOW);
    expect(r.status).toBe("ok");
    expect(r.duplicateGroups[0]!.count).toBe(10);
    expect(r.duplicateGroups[0]!.authors).toBe(10);
    expect(r.temporalBursts.length).toBeGreaterThanOrEqual(1);
    expect(r.suspiciousPct.value).toBeGreaterThan(30);
    expect(r.flagged.some((f) => f.author === "spammer_x")).toBe(true);
    expect(r.signals.map((s) => s.key)).toContain("exactDuplicate");
    // interval surrounds point estimate
    expect(r.suspiciousPct.interval!.low).toBeLessThanOrEqual(r.suspiciousPct.value!);
  });
  it("same text from the SAME account is not a multi-account duplicate", () => {
    const comments = Array.from({ length: 12 }, (_, i) => mk(i, i < 3 ? "fan_one" : `p${i}`, i < 3 ? "see you tonight" : `comment number ${i} with substance`));
    const r = analyzeComments(12, { comments, meta: { sampleSize: 12, method: "t", representative: true } }, DEFAULT_SUSPICION_WEIGHTS, undefined, NOW);
    expect(r.duplicateGroups.length).toBe(0);
  });
});
