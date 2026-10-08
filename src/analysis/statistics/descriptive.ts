/** Descriptive statistics helpers. All functions are pure and tolerate empty input. */

export function sum(values: number[]): number {
  let s = 0;
  for (const v of values) s += v;
  return s;
}

export function mean(values: number[]): number {
  if (values.length === 0) return NaN;
  return sum(values) / values.length;
}

export function sorted(values: number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const s = sorted(values);
  const mid = Math.floor(s.length / 2);
  if (s.length % 2 === 0) return ((s[mid - 1] as number) + (s[mid] as number)) / 2;
  return s[mid] as number;
}

/** Linear-interpolated percentile, p in [0,100]. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return NaN;
  const s = sorted(values);
  const clamped = Math.min(100, Math.max(0, p));
  const idx = (clamped / 100) * (s.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return s[lo] as number;
  const w = idx - lo;
  return (s[lo] as number) * (1 - w) + (s[hi] as number) * w;
}

export function variance(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  let acc = 0;
  for (const v of values) acc += (v - m) ** 2;
  return acc / (values.length - 1);
}

export function stdDev(values: number[]): number {
  return Math.sqrt(variance(values));
}

export function zScores(values: number[]): number[] {
  const sd = stdDev(values);
  const m = mean(values);
  if (!isFinite(sd) || sd === 0) return values.map(() => 0);
  return values.map((v) => (v - m) / sd);
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function clamp01(v: number): number {
  return clamp(v, 0, 1);
}

export function round(v: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

/** Sigmoid-like squash mapping a ratio above `threshold` to 0..1 smoothly. */
export function softThreshold(value: number, threshold: number, width: number): number {
  if (width <= 0) return value >= threshold ? 1 : 0;
  return clamp01(1 / (1 + Math.exp(-(value - threshold) / width)));
}
