import { median } from "./descriptive";

export interface Burst {
  start: string;
  end: string;
  count: number;
}

/**
 * Detect temporal bursts: windows where many events happen much faster than
 * the typical inter-arrival gap. Works on ISO timestamps; ignores invalid ones.
 */
export function detectBursts(
  timestamps: string[],
  opts: { minEvents?: number; windowMs?: number } = {},
): { bursts: Burst[]; burstEventShare: number; medianGapMs: number | null } {
  const times = timestamps
    .map((t) => Date.parse(t))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);
  if (times.length < 3) return { bursts: [], burstEventShare: 0, medianGapMs: null };

  const gaps: number[] = [];
  for (let i = 1; i < times.length; i++) gaps.push((times[i] as number) - (times[i - 1] as number));
  const medGap = median(gaps);
  // A burst window is a fixed window, or 1/5 of the median gap if that is smaller.
  const windowMs = opts.windowMs ?? Math.max(5_000, Math.min(120_000, medGap / 5));
  const minEvents = opts.minEvents ?? 5;

  const bursts: Burst[] = [];
  let i = 0;
  let inBurst = 0;
  while (i < times.length) {
    let j = i;
    while (j + 1 < times.length && (times[j + 1] as number) - (times[i] as number) <= windowMs) j++;
    const count = j - i + 1;
    if (count >= minEvents) {
      bursts.push({
        start: new Date(times[i] as number).toISOString(),
        end: new Date(times[j] as number).toISOString(),
        count,
      });
      inBurst += count;
      i = j + 1;
    } else {
      i++;
    }
  }
  return { bursts, burstEventShare: inBurst / times.length, medianGapMs: medGap };
}
