/** Shannon entropy (bits) of the character distribution of a string. */
export function shannonEntropy(text: string): number {
  if (!text) return 0;
  const counts = new Map<string, number>();
  for (const ch of text) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  const n = text.length;
  let h = 0;
  for (const c of counts.values()) {
    const p = c / n;
    h -= p * Math.log2(p);
  }
  return h;
}

/** Normalized entropy in 0..1 relative to the maximum possible for the alphabet size used. */
export function normalizedEntropy(text: string): number {
  if (!text || text.length < 2) return 0;
  const distinct = new Set(text).size;
  if (distinct <= 1) return 0;
  return shannonEntropy(text) / Math.log2(distinct);
}

/** Entropy (bits) of a categorical distribution given counts. */
export function distributionEntropy(counts: number[]): number {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  let h = 0;
  for (const c of counts) {
    if (c === 0) continue;
    const p = c / total;
    h -= p * Math.log2(p);
  }
  return h;
}
