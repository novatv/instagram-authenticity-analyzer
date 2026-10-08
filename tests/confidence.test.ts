import { describe, it, expect } from "vitest";
import { sampleAdequacy, levelFromCoverage, buildConfidence } from "@/analysis/confidence/confidence";
import { combineScores } from "@/analysis/scoring/combine";

describe("confidence", () => {
  it("30 of 2M is LOW, 1400 of 50k is HIGH-ish adequacy", () => {
    expect(sampleAdequacy(30, 2_000_000)).toBeLessThan(0.4);
    expect(sampleAdequacy(1400, 50_000)).toBeGreaterThan(0.6);
    expect(sampleAdequacy(0)).toBe(0);
    expect(sampleAdequacy(5000, 10_000)).toBeGreaterThan(sampleAdequacy(500, 10_000));
  });
  it("levels depend on coverage and sample size", () => {
    expect(levelFromCoverage(0.9, 1000)).toBe("HIGH");
    expect(levelFromCoverage(0.9, 150)).toBe("MEDIUM");
    expect(levelFromCoverage(0.9, 50)).toBe("LOW");
    expect(levelFromCoverage(0.2, 5000)).toBe("LOW");
  });
  it("buildConfidence lists missing facets as reasons", () => {
    const { report, facets } = buildConfidence([
      { key: "a", label: "Profile", weight: 0.5, availability: 1, status: "observed" },
      { key: "b", label: "Followers", weight: 0.5, availability: 0, status: "unavailable", note: "API does not expose" },
    ], 0);
    expect(report.dataCoverage).toBe(0.5);
    expect(report.level).toBe("LOW");
    expect(report.reasons.join(" ")).toContain("Followers");
    expect(facets).toHaveLength(2);
  });
});

describe("combineScores", () => {
  it("renormalizes over available components", () => {
    const r = combineScores([
      { label: "A", score: 80, weight: 0.6 },
      { label: "B", score: undefined, weight: 0.4 },
    ], 0.3);
    expect(r.score.value).toBe(80);
    expect(r.explanation.drivers[1]!.detail).toContain("Unavailable");
  });
  it("returns unavailable when too little weight is present", () => {
    const r = combineScores([
      { label: "A", score: undefined, weight: 0.7 },
      { label: "B", score: 50, weight: 0.3 },
    ], 0.35);
    expect(r.score.status).toBe("unavailable");
  });
});
