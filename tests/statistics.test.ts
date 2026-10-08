import { describe, it, expect } from "vitest";
import { median, percentile, zScores, robustZScores, mad, detectOutliersRobust, detectOutliersIQR, shannonEntropy, normalizedEntropy, wilsonInterval, scaleInterval, detectBursts, softThreshold } from "@/analysis/statistics";

describe("descriptive statistics", () => {
  it("median handles odd/even/empty", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(Number.isNaN(median([]))).toBe(true);
  });
  it("percentile interpolates", () => {
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
    expect(percentile([1, 2, 3, 4], 50)).toBe(2.5);
    expect(percentile([10], 90)).toBe(10);
  });
  it("z-scores are zero for constant input", () => {
    expect(zScores([5, 5, 5])).toEqual([0, 0, 0]);
    expect(robustZScores([5, 5, 5])).toEqual([0, 0, 0]);
  });
  it("mad and robust z flag outliers that classic z misses in tiny samples", () => {
    const values = [10, 11, 10, 12, 11, 10, 11, 1000];
    expect(mad(values)).toBeGreaterThan(0);
    const out = detectOutliersRobust(values);
    expect(out.map((o) => o.index)).toEqual([7]);
    expect(detectOutliersIQR(values)).toEqual([7]);
  });
  it("softThreshold is monotonic and bounded", () => {
    expect(softThreshold(0, 1, 0.3)).toBeLessThan(0.1);
    expect(softThreshold(1, 1, 0.3)).toBeCloseTo(0.5, 5);
    expect(softThreshold(3, 1, 0.3)).toBeGreaterThan(0.99);
  });
});

describe("entropy", () => {
  it("is 0 for single-character strings and higher for diverse text", () => {
    expect(shannonEntropy("aaaa")).toBe(0);
    expect(shannonEntropy("abcd")).toBeCloseTo(2, 5);
    expect(normalizedEntropy("aaaaaaab")).toBeLessThan(0.6);
    expect(normalizedEntropy("abcdefgh")).toBeCloseTo(1, 5);
  });
});

describe("intervals", () => {
  it("wilson interval contains the proportion and narrows with n", () => {
    const small = wilsonInterval(5, 30);
    const big = wilsonInterval(500, 3000);
    expect(small.low).toBeLessThan(5 / 30);
    expect(small.high).toBeGreaterThan(5 / 30);
    expect(big.high - big.low).toBeLessThan(small.high - small.low);
  });
  it("finite population correction narrows the interval", () => {
    const noFpc = wilsonInterval(50, 200);
    const fpc = wilsonInterval(50, 200, 1.96, 250);
    expect(fpc.high - fpc.low).toBeLessThan(noFpc.high - noFpc.low);
  });
  it("handles n=0 and scales to counts", () => {
    expect(wilsonInterval(0, 0)).toEqual({ low: 0, high: 1 });
    expect(scaleInterval({ low: 0.1, high: 0.2 }, 1000)).toEqual({ low: 100, high: 200 });
  });
});

describe("temporal bursts", () => {
  it("detects a burst among spread events", () => {
    const base = Date.parse("2026-01-01T00:00:00Z");
    const spread = Array.from({ length: 20 }, (_, i) => new Date(base + i * 3_600_000).toISOString());
    const burst = Array.from({ length: 8 }, (_, i) => new Date(base + 5 * 3_600_000 + i * 2_000).toISOString());
    const res = detectBursts([...spread, ...burst]);
    expect(res.bursts.length).toBeGreaterThanOrEqual(1);
    expect(res.bursts[0]!.count).toBeGreaterThanOrEqual(8);
    expect(res.burstEventShare).toBeGreaterThan(0.2);
  });
  it("returns nothing for too few or invalid timestamps", () => {
    expect(detectBursts(["bad", "2026-01-01"]).bursts).toEqual([]);
  });
});
