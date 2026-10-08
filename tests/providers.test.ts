import { describe, it, expect } from "vitest";
import { MockProvider } from "@/providers/MockProvider";
import { MetaGraphProvider } from "@/providers/MetaGraphProvider";
import { analyzeProfile } from "@/analysis/analyzeProfile";
import { analyzePost } from "@/analysis/analyzePost";
import { DEFAULT_SUSPICION_WEIGHTS } from "@/config/weights";

const NOW = Date.parse("2026-10-08T12:00:00Z");
const mock = new MockProvider({ now: NOW });

describe("MockProvider", () => {
  it("never invents unknown profiles", async () => {
    const r = await mock.getProfile("not_in_demo");
    expect(r.status).toBe("unavailable");
  });
  it("marks data as demo", async () => {
    const r = await mock.getProfile("demo_organic");
    expect(r.status).toBe("available");
    if (r.status === "available") expect(r.isDemo).toBe(true);
  });
});

describe("profile analysis end-to-end (demo data)", () => {
  it("organic vs inflated", async () => {
    const organic = await analyzeProfile(mock, "demo_organic", DEFAULT_SUSPICION_WEIGHTS, NOW);
    const inflated = await analyzeProfile(mock, "demo_inflated", DEFAULT_SUSPICION_WEIGHTS, NOW);
    if ("error" in organic || "error" in inflated) throw new Error("unexpected");
    expect(organic.audience.status).toBe("ok");
    expect(inflated.audience.status).toBe("ok");
    expect(organic.audience.botFakeScore.value!).toBeLessThan(inflated.audience.botFakeScore.value!);
    expect(organic.score!).toBeGreaterThan(inflated.score!);
    expect(organic.confidence.level).toBe("HIGH");
    expect(inflated.engagement.qualityScore.value!).toBeLessThan(organic.engagement.qualityScore.value!);
  });
  it("tiny sample of huge account → LOW confidence, no audience extrapolation", async () => {
    const r = await analyzeProfile(mock, "demo_small_sample", DEFAULT_SUSPICION_WEIGHTS, NOW);
    if ("error" in r) throw new Error("unexpected");
    expect(r.confidence.level).toBe("LOW");
    expect(r.audience.status).toBe("ok"); // exactly 30 = minimum, allowed but LOW
    expect(r.audience.suspiciousPct.interval!.high - r.audience.suspiciousPct.interval!.low).toBeGreaterThan(20);
  });
  it("no follower sample → audience INSUFFICIENT with explanation, engagement still computed", async () => {
    const r = await analyzeProfile(mock, "demo_noaudience", DEFAULT_SUSPICION_WEIGHTS, NOW);
    if ("error" in r) throw new Error("unexpected");
    expect(r.audience.status).toBe("insufficient");
    expect(r.audience.missing.length).toBeGreaterThan(0);
    expect(r.engagement.status).toBe("ok");
    expect(r.facets.find((f) => f.key === "followerSample")!.status).toBe("unavailable");
  });
  it("private account → everything unavailable except counts", async () => {
    const r = await analyzeProfile(mock, "demo_private", DEFAULT_SUSPICION_WEIGHTS, NOW);
    if ("error" in r) throw new Error("unexpected");
    expect(r.profile.isPrivate).toBe(true);
    expect(r.audience.status).toBe("insufficient");
    expect(r.engagement.status).toBe("insufficient");
    expect(r.score).toBeUndefined();
  });
  it("unknown username → error", async () => {
    const r = await analyzeProfile(mock, "whoever", DEFAULT_SUSPICION_WEIGHTS, NOW);
    expect("error" in r).toBe(true);
  });
});

describe("post analysis end-to-end (demo data)", () => {
  it("analyzes an inflated demo post", async () => {
    const r = await analyzePost(mock, { shortcode: "DEMOINFL001", url: "https://www.instagram.com/p/DEMOINFL001/" }, DEFAULT_SUSPICION_WEIGHTS, NOW);
    if ("error" in r) throw new Error(r.reason);
    expect(r.post.likes.status).toBe("observed");
    expect(r.likes.status).toBe("ok");
    expect(r.likes.suspiciousPct.value!).toBeGreaterThan(25);
    expect(r.commentsAnalysis.status).toBe("ok");
    expect(r.commentsAnalysis.duplicateGroups.length).toBeGreaterThan(0);
    expect(r.overallScore.status).toBe("estimated");
    const organic = await analyzePost(mock, { shortcode: "DEMOORGA002", url: "" }, DEFAULT_SUSPICION_WEIGHTS, NOW);
    if ("error" in organic) throw new Error(organic.reason);
    expect(organic.overallScore.value!).toBeGreaterThan(r.overallScore.value!);
  });
  it("unknown post → error, never random numbers", async () => {
    const r = await analyzePost(mock, { shortcode: "ZZZZZZZZZ", url: "" }, DEFAULT_SUSPICION_WEIGHTS, NOW);
    expect("error" in r).toBe(true);
  });
});

describe("MetaGraphProvider", () => {
  it("maps business discovery and reports unavailable datasets honestly", async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ business_discovery: { username: "brand", followers_count: 1000, follows_count: 10, media_count: 5, media: { data: [{ id: "1", permalink: "https://www.instagram.com/p/ABC/", like_count: 10, comments_count: 1, timestamp: "2026-01-01T00:00:00Z", media_product_type: "REELS" }] } } }), { status: 200 })) as unknown as typeof fetch;
    const p = new MetaGraphProvider({ accessToken: "t", businessAccountId: "1", fetchImpl });
    const prof = await p.getProfile("brand");
    expect(prof.status).toBe("available");
    const posts = await p.getPublicPosts("brand");
    expect(posts.status === "available" && posts.data[0]!.shortcode).toBe("ABC");
    expect(posts.status === "available" && posts.data[0]!.kind).toBe("reel");
    expect((await p.getFollowerSample()).status).toBe("unavailable");
    expect((await p.getLikers()).status).toBe("unavailable");
    expect((await p.getProfile("bad name")).status).toBe("unavailable");
  });
  it("resolves a pasted post link through oEmbed + business discovery", async () => {
    const fetchImpl = (async (input: string | URL | Request) => {
      const u = String(input);
      if (u.includes("instagram_oembed")) return new Response(JSON.stringify({ author_name: "brand" }), { status: 200 });
      return new Response(JSON.stringify({ business_discovery: { username: "brand", followers_count: 1000, media: { data: [{ id: "9", permalink: "https://www.instagram.com/reel/ABC/", like_count: 50, comments_count: 4 }] } } }), { status: 200 });
    }) as unknown as typeof fetch;
    const p = new MetaGraphProvider({ accessToken: "t", businessAccountId: "1", fetchImpl });
    const r = await p.getPost({ shortcode: "ABC", url: "https://www.instagram.com/reel/ABC/" });
    expect(r.status === "available" && r.data.ownerUsername).toBe("brand");
    expect(r.status === "available" && r.data.likesCount).toBe(50);
    const miss = await p.getPost({ shortcode: "ZZZ", url: "https://www.instagram.com/p/ZZZ/" });
    expect(miss.status === "unavailable" && miss.reason).toContain("not among");
  });
  it("surfaces API errors without retrying", async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ error: { message: "rate", code: 4 } }), { status: 400 })) as unknown as typeof fetch;
    const p = new MetaGraphProvider({ accessToken: "t", businessAccountId: "1", fetchImpl });
    const r = await p.getProfile("brand");
    expect(r.status === "unavailable" && r.reason).toContain("Rate limited");
  });
});

describe("overall score requires audience data", () => {
  it("engagement alone never yields an overall score", async () => {
    const r = await analyzeProfile(mock, "demo_noaudience", DEFAULT_SUSPICION_WEIGHTS, NOW);
    if ("error" in r) throw new Error("unexpected");
    expect(r.score).toBeUndefined();
    expect(r.engagement.qualityScore.status).toBe("estimated");
  });
});
