import { describe, it, expect } from "vitest";
import { ManualProvider } from "@/providers/ManualProvider";
import { analyzeProfile } from "@/analysis/analyzeProfile";
import { DEFAULT_SUSPICION_WEIGHTS } from "@/config/weights";
import { parsePostLines } from "@/components/ManualCheckForm";

describe("manual quick check", () => {
  it("parses K/M formats and comma-separated lines", () => {
    const { rows, bad } = parsePostLines("1240, 38\n1.1K 41\n2,3M;95\nabc\n");
    expect(rows).toEqual([{ likes: 1240, comments: 38, views: undefined }, { likes: 1100, comments: 41, views: undefined }, { likes: 2_300_000, comments: 95, views: undefined }]);
    expect(bad).toEqual([4]);
  });
  it("flags an inflated profile from public counts only", async () => {
    const inflated = new ManualProvider({ username: "dj_inflado", followersCount: 250_000, followingCount: 900, postsCount: 80, recentPosts: Array.from({ length: 10 }, (_, i) => ({ likes: 700 + (i % 2) * 5, comments: 2 })) });
    const r = await analyzeProfile(inflated, "dj_inflado", DEFAULT_SUSPICION_WEIGHTS);
    if ("error" in r) throw new Error(r.reason);
    expect(r.engagement.status).toBe("ok");
    expect(r.engagement.qualityScore.value!).toBeLessThan(40);
    expect(r.audience.status).toBe("insufficient");
    expect(r.score).toBeUndefined();
    expect(r.provider.isDemo).toBe(false);
    const healthy = new ManualProvider({ username: "dj_real", followersCount: 25_000, recentPosts: [{ likes: 900, comments: 40 }, { likes: 1500, comments: 70 }, { likes: 650, comments: 22 }, { likes: 1100, comments: 51 }, { likes: 2400, comments: 130 }] });
    const h = await analyzeProfile(healthy, "dj_real", DEFAULT_SUSPICION_WEIGHTS);
    if ("error" in h) throw new Error(h.reason);
    expect(h.engagement.qualityScore.value!).toBeGreaterThan(80);
  });
  it("needs at least 3 posts", async () => {
    const p = new ManualProvider({ username: "x", followersCount: 1000, recentPosts: [{ likes: 10 }] });
    const r = await analyzeProfile(p, "x", DEFAULT_SUSPICION_WEIGHTS);
    if ("error" in r) throw new Error(r.reason);
    expect(r.engagement.status).toBe("insufficient");
  });
});
