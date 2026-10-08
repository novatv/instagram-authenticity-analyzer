import { median } from "./descriptive";

/** Median absolute deviation. */
export function mad(values: number[]): number {
  if (values.length === 0) return NaN;
  const m = median(values);
  return median(values.map((v) => Math.abs(v - m)));
}

/**
 * Robust z-score using MAD (scaled by 1.4826 to be consistent with a
 * normal distribution's standard deviation). Returns 0 when MAD is 0.
 */
export function robustZScores(values: number[]): number[] {
  if (values.length === 0) return [];
  const m = median(values);
  const d = mad(values) * 1.4826;
  if (!isFinite(d) || d === 0) return values.map(() => 0);
  return values.map((v) => (v - m) / d);
}
