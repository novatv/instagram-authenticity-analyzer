import type { ConfidenceReport, ConfidenceLevel, DataFacet } from "@/types/results";
import { clamp01, round } from "@/analysis/statistics";

export interface FacetInput {
  key: string;
  label: string;
  /** importance of this facet for the analysis (0..1), sums to ~1 across facets */
  weight: number;
  /** 0..1 availability (1 = fully observed; partial for small samples) */
  availability: number;
  status: "observed" | "estimated" | "unavailable";
  note?: string;
}

/**
 * Sample adequacy: how much a sample of size n from a population of size N
 * can be trusted. Based on the Wilson interval half-width at p=0.5 and a
 * log-scaled absolute size term so very small samples are always penalized.
 */
export function sampleAdequacy(n: number, population?: number): number {
  if (n <= 0) return 0;
  const halfWidth = 0.98 / Math.sqrt(n); // ≈ z·sqrt(p(1-p)/n) at p=.5, z=1.96
  let precision = clamp01(1 - halfWidth / 0.25); // 0 when ±25pp, 1 when ±0pp
  const sizeTerm = clamp01(Math.log10(n + 1) / 3); // 1000 → 1
  precision = Math.min(precision, Math.max(sizeTerm, precision * 0.8));
  if (population && population > 0) {
    const frac = n / population;
    // When population is huge and sample tiny, cap adequacy; coverage of 1%+ is fine statistically
    const fracTerm = clamp01(Math.log10(frac * 1000 + 1) / Math.log10(1001)); // frac 0.001→0.5, 1→1
    precision = precision * (0.6 + 0.4 * fracTerm);
  }
  return clamp01(precision);
}

export function levelFromCoverage(coverage: number, sampleSize: number): ConfidenceLevel {
  if (coverage >= 0.7 && sampleSize >= 300) return "HIGH";
  if (coverage >= 0.5 && sampleSize >= 100) return "MEDIUM";
  return "LOW";
}

export function buildConfidence(facets: FacetInput[], sampleSize: number, populationSize?: number): { report: ConfidenceReport; facets: DataFacet[] } {
  const totalWeight = facets.reduce((a, f) => a + f.weight, 0) || 1;
  const coverage = clamp01(facets.reduce((a, f) => a + f.weight * clamp01(f.availability), 0) / totalWeight);
  const level = levelFromCoverage(coverage, sampleSize);
  const reasons: string[] = [];
  for (const f of facets) {
    if (f.availability === 0) reasons.push(`${f.label}: unavailable${f.note ? ` (${f.note})` : ""}`);
    else if (f.availability < 0.6) reasons.push(`${f.label}: limited (${Math.round(f.availability * 100)}% adequacy)`);
  }
  if (sampleSize > 0 && populationSize && sampleSize / populationSize < 0.001) {
    reasons.push(`Sample is ${round((sampleSize / populationSize) * 100, 3)}% of the population; estimates carry wide intervals.`);
  }
  if (reasons.length === 0) reasons.push("All requested data facets were available with adequate sample sizes.");
  return {
    report: {
      level,
      dataCoverage: round(coverage, 2),
      sampleSize,
      populationSize,
      samplingFraction: populationSize ? round(sampleSize / populationSize, 4) : undefined,
      reasons,
    },
    facets: facets.map((f) => ({ key: f.key, label: f.label, status: f.status, note: f.note })),
  };
}
