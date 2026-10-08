import { percentile } from "./descriptive";
import { robustZScores } from "./robust";

export interface OutlierResult {
  index: number;
  value: number;
  robustZ: number;
}

/** Detect outliers via robust z-score (MAD based). */
export function detectOutliersRobust(values: number[], threshold = 3.5): OutlierResult[] {
  const z = robustZScores(values);
  const out: OutlierResult[] = [];
  z.forEach((rz, i) => {
    if (Math.abs(rz) >= threshold) out.push({ index: i, value: values[i] as number, robustZ: rz });
  });
  return out;
}

/** Tukey fences (IQR based). Returns indices outside [Q1-k*IQR, Q3+k*IQR]. */
export function detectOutliersIQR(values: number[], k = 1.5): number[] {
  if (values.length < 4) return [];
  const q1 = percentile(values, 25);
  const q3 = percentile(values, 75);
  const iqr = q3 - q1;
  const lo = q1 - k * iqr;
  const hi = q3 + k * iqr;
  const idx: number[] = [];
  values.forEach((v, i) => {
    if (v < lo || v > hi) idx.push(i);
  });
  return idx;
}
