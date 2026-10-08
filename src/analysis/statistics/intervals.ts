import type { Interval } from "@/types/results";
import { clamp01 } from "./descriptive";

/**
 * Wilson score interval for a binomial proportion.
 * Returns proportions in 0..1. Applies a finite population correction when
 * the population size is known and the sample is a non-trivial fraction of it.
 */
export function wilsonInterval(
  successes: number,
  n: number,
  z = 1.96,
  populationSize?: number,
): Interval {
  if (n <= 0) return { low: 0, high: 1 };
  const p = successes / n;
  const z2 = z * z;
  let fpc = 1;
  if (populationSize && populationSize > n) {
    fpc = Math.sqrt((populationSize - n) / (populationSize - 1));
  }
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = ((z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom) * fpc;
  return { low: clamp01(center - half), high: clamp01(center + half) };
}

/** Scale a proportion interval to a population count interval. */
export function scaleInterval(iv: Interval, population: number): Interval {
  return { low: Math.round(iv.low * population), high: Math.round(iv.high * population) };
}

/** Width of an interval (0..1 for proportions). */
export function intervalWidth(iv: Interval): number {
  return iv.high - iv.low;
}
