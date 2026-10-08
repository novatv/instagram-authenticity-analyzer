import type { Metric, ScoreExplanation } from "@/types/results";

export interface ComponentScore {
  label: string;
  /** 0..100 authenticity-oriented score (100 = authentic) */
  score: number | undefined;
  weight: number;
  detail?: string;
}

/**
 * Combine component scores into an overall authenticity score, re-normalizing
 * weights over the components that are actually available. Returns undefined
 * when none is available or when the available weight is below `minWeight`.
 */
export function combineScores(components: ComponentScore[], minWeight = 0.3): { score: Metric; explanation: ScoreExplanation } {
  const avail = components.filter((c) => typeof c.score === "number");
  const w = avail.reduce((a, c) => a + c.weight, 0);
  const total = components.reduce((a, c) => a + c.weight, 0) || 1;
  if (avail.length === 0 || w / total < minWeight) {
    return {
      score: { label: "Overall Authenticity Score", status: "unavailable", note: "Insufficient components available to produce an overall score" },
      explanation: {
        title: "Why no overall score?",
        summary: "Too few analysis components had enough data.",
        drivers: components.map((c) => ({ label: c.label, impact: 0, detail: typeof c.score === "number" ? `Available (${c.score})` : "Unavailable" })),
      },
    };
  }
  const value = Math.round(avail.reduce((a, c) => a + (c.score as number) * c.weight, 0) / w);
  return {
    score: {
      label: "Overall Authenticity Score",
      status: "estimated",
      value,
      unit: "score",
      note: `Weighted over ${avail.length} of ${components.length} components (${Math.round((w / total) * 100)}% of model weight)`,
    },
    explanation: {
      title: "Why this overall score?",
      summary: `Weighted average of available components: ${avail.map((c) => `${c.label} ${c.score} (w ${c.weight})`).join(", ")}.`,
      drivers: components.map((c) => ({
        label: c.label,
        impact: typeof c.score === "number" ? Math.round((c.weight / w) * 100) : 0,
        detail: typeof c.score === "number" ? `${c.score}/100${c.detail ? ` — ${c.detail}` : ""}` : "Unavailable — excluded from the weighted average",
      })),
    },
  };
}
